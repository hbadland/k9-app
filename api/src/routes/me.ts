import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as UserModel from '../models/user';
import { pool } from '../config/db';
import { stripe } from '../config/stripe';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function getS3(): S3Client | null {
  if (!process.env.R2_ACCOUNT_ID) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

async function uploadToStorage(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const s3 = getS3();
  if (!s3) throw new Error('CDN_NOT_CONFIGURED');
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET ?? '',
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  const publicUrl = process.env.R2_PUBLIC_URL ?? '';
  return `${publicUrl}/${key}`;
}

// ── Profile ───────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await UserModel.findById(req.user!.userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const { password_hash: _, ...safeUser } = user;
  res.json(safeUser);
});

const updateSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name:  z.string().min(1).optional(),
  phone:      z.string().optional(),
  address:    z.string().optional(),
});

router.put('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const user = await UserModel.updateUser(req.user!.userId, parsed.data);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const { password_hash: _, ...safeUser } = user;
  res.json(safeUser);
});

router.post('/push-token', requireAuth, async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') { res.status(400).json({ error: 'token required' }); return; }
  await pool.query('UPDATE users SET expo_push_token=$1 WHERE id=$2', [token, req.user!.userId]);
  res.json({ ok: true });
});

// ── Avatar upload ─────────────────────────────────────────────────────────

router.post('/avatar', requireAuth, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'avatar file required' }); return; }
  try {
    const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
    const key = `avatars/users/${req.user!.userId}-${Date.now()}.${ext}`;
    const url = await uploadToStorage(req.file.buffer, key, req.file.mimetype);
    await UserModel.updateAvatarUrl(req.user!.userId, url);
    res.json({ avatar_url: url });
  } catch (e: any) {
    if (e.message === 'CDN_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Image storage not configured. Set R2_* environment variables.' });
      return;
    }
    throw e;
  }
});

// ── GDPR: data export ─────────────────────────────────────────────────────

router.get('/export', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const [userRes, dogsRes, bookingsRes, messagesRes, transactionsRes] = await Promise.all([
    pool.query('SELECT id,email,first_name,last_name,phone,address,status,created_at FROM users WHERE id=$1', [userId]),
    pool.query('SELECT * FROM dogs WHERE owner_id=$1', [userId]),
    pool.query(`
      SELECT b.*, s.date AS slot_date, s.start_time, s.end_time, sv.name AS service_name
      FROM bookings b
      JOIN availability_slots s ON s.id = b.slot_id
      JOIN services sv ON sv.id = s.service_id
      WHERE b.owner_id = $1
    `, [userId]),
    pool.query('SELECT id,sender_role,body,type,created_at FROM messages WHERE sender_id=$1', [userId]),
    pool.query(`
      SELECT wt.amount,wt.type,wt.description,wt.created_at
      FROM wallet_transactions wt
      JOIN wallets w ON w.id = wt.wallet_id
      WHERE w.user_id=$1
    `, [userId]),
  ]);

  res.json({
    exported_at: new Date().toISOString(),
    profile: userRes.rows[0],
    dogs: dogsRes.rows,
    bookings: bookingsRes.rows,
    messages: messagesRes.rows,
    transactions: transactionsRes.rows,
  });
});

// ── GDPR: account deletion ────────────────────────────────────────────────

router.delete('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = await UserModel.findById(userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  // Cancel Stripe subscription if active
  if (user.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active' });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id);
      }
    } catch (err) {
      console.error('[delete account] Stripe cancellation error:', err);
    }
  }

  await UserModel.deleteUserAndData(userId);
  res.json({ ok: true });
});

export default router;
