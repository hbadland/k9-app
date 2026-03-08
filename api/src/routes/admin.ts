import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import * as DogModel from '../models/dog';
import * as UserModel from '../models/user';
import * as BookingModel from '../models/booking';
import * as MessageModel from '../models/message';
import { pool } from '../config/db';
import { simulator } from '../services/locationSimulator';
import { getIo } from '../config/io';
import { sendPush } from '../utils/push';
import { sendEmail } from '../utils/email';
import { walkStartedEmail, walkCompletedEmail, walkConfirmedEmail } from '../utils/emailTemplates';

const router = Router();

router.use(requireAuth, requireRole('admin'));

// ── Clients ───────────────────────────────────────────────────────────────

router.get('/clients', async (req, res: Response) => {
  const { search, status, sort } = req.query as Record<string, string>;
  let query = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.address,
           u.status, u.admin_notes, u.created_at,
           json_agg(
             json_build_object(
               'id', d.id, 'name', d.name, 'breed', d.breed,
               'age_months', d.age_months, 'vet_name', d.vet_name,
               'vet_phone', d.vet_phone, 'medical_notes', d.medical_notes,
               'behavioural_notes', d.behavioural_notes
             )
           ) FILTER (WHERE d.id IS NOT NULL) AS dogs
    FROM users u
    LEFT JOIN dogs d ON d.owner_id = u.id
    WHERE u.role = 'owner'
  `;
  const params: string[] = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }
  if (status && ['pending', 'active', 'inactive'].includes(status)) {
    params.push(status);
    query += ` AND u.status = $${params.length}`;
  }

  query += ' GROUP BY u.id';

  const validSorts: Record<string, string> = {
    joined: 'u.created_at DESC',
    name: 'u.first_name ASC',
  };
  query += ` ORDER BY ${validSorts[sort] ?? 'u.created_at DESC'}`;

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

router.get('/clients/:id', async (req, res: Response) => {
  const client = await DogModel.getClientById(req.params.id);
  if (!client) { res.status(404).json({ error: 'Client not found' }); return; }
  res.json(client);
});

const notesSchema = z.object({ notes: z.string() });

router.post('/clients/:id/notes', async (req, res: Response) => {
  const parsed = notesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  await UserModel.setAdminNotes(req.params.id, parsed.data.notes);
  res.json({ ok: true });
});

const statusSchema = z.object({ status: z.enum(['pending', 'active', 'inactive']) });

router.patch('/clients/:id/status', async (req, res: Response) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  await UserModel.setClientStatus(req.params.id, parsed.data.status);
  res.json({ ok: true });
});

// ── Bookings ──────────────────────────────────────────────────────────────

router.get('/bookings', async (_req, res: Response) => {
  const bookings = await BookingModel.getAllBookings();
  res.json(bookings);
});

router.get('/bookings/:id/messages', async (req, res: Response) => {
  const msgs = await MessageModel.getMessages(req.params.id);
  res.json(msgs);
});

const bookingStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']),
});

router.patch('/bookings/:id/status', async (req: AuthRequest, res: Response) => {
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const ok = await BookingModel.updateBookingStatus(req.params.id, parsed.data.status);
  if (!ok) { res.status(404).json({ error: 'Booking not found' }); return; }

  const { rows } = await pool.query(`
    SELECT b.dog_id, b.slot_id,
           u.expo_push_token, u.email, u.first_name,
           d.name AS dog_name,
           sv.name AS service_name, sv.duration_minutes,
           s.date AS slot_date, s.start_time AS slot_start, s.end_time AS slot_end
    FROM bookings b
    JOIN users u ON u.id = b.owner_id
    JOIN dogs d ON d.id = b.dog_id
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN services sv ON sv.id = s.service_id
    WHERE b.id = $1
  `, [req.params.id]);

  const row = rows[0];
  const dogId = row?.dog_id;
  const newStatus = parsed.data.status;

  // Drive location simulator
  if (dogId) {
    if (newStatus === 'in_progress') {
      const useSimulator = process.env.USE_SIMULATOR === 'true';
      if (useSimulator) simulator.start(dogId, req.params.id);
    } else if (['completed', 'cancelled'].includes(newStatus)) {
      simulator.stop(dogId);
    }
  }

  // Auto-generate walk report on completion
  if (newStatus === 'completed' && row) {
    try {
      // Compute distance from GPS points (Haversine sum)
      const { rows: locRows } = await pool.query(
        'SELECT latitude, longitude FROM dog_locations WHERE booking_id = $1 ORDER BY recorded_at ASC',
        [req.params.id]
      );
      let distanceMetres = 0;
      for (let i = 1; i < locRows.length; i++) {
        distanceMetres += haversineMetres(
          locRows[i - 1].latitude, locRows[i - 1].longitude,
          locRows[i].latitude, locRows[i].longitude
        );
      }

      // Collect photo URLs from walk messages
      const { rows: photoRows } = await pool.query(
        "SELECT photo_url FROM messages WHERE booking_id = $1 AND photo_url IS NOT NULL AND type = 'update'",
        [req.params.id]
      );
      const photoUrls = photoRows.map(r => r.photo_url);

      await pool.query(
        `INSERT INTO walk_reports (booking_id, distance_metres, duration_seconds, photo_urls)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (booking_id) DO UPDATE
         SET distance_metres = $2, duration_seconds = $3, photo_urls = $4`,
        [req.params.id, distanceMetres.toFixed(2), (row.duration_minutes ?? 60) * 60, JSON.stringify(photoUrls)]
      );
    } catch (err) {
      console.error('[walk report] Generation error:', err);
    }
  }

  // Push notification to owner
  const pushToken = row?.expo_push_token;
  if (pushToken) {
    if (newStatus === 'in_progress') {
      sendPush(pushToken, '🐾 Walk started!', 'Your dog is on their way', { bookingId: req.params.id });
    } else if (newStatus === 'completed') {
      sendPush(pushToken, '✅ Walk complete', 'Check the walk report', { bookingId: req.params.id });
    }
  }

  // Email to owner
  if (row?.email) {
    if (newStatus === 'confirmed') {
      sendEmail({
        to: row.email,
        subject: `Walk confirmed — ${row.dog_name}`,
        html: walkConfirmedEmail({
          firstName: row.first_name,
          dogName: row.dog_name,
          slotDate: row.slot_date,
          slotStart: row.slot_start,
          bookingId: req.params.id,
        }),
      });
    } else if (newStatus === 'in_progress') {
      sendEmail({
        to: row.email,
        subject: `${row.dog_name}'s walk has started!`,
        html: walkStartedEmail({
          firstName: row.first_name,
          dogName: row.dog_name,
          bookingId: req.params.id,
        }),
      });
    } else if (newStatus === 'completed') {
      sendEmail({
        to: row.email,
        subject: `${row.dog_name}'s walk is complete!`,
        html: walkCompletedEmail({
          firstName: row.first_name,
          dogName: row.dog_name,
          durationMinutes: row.duration_minutes ?? 60,
          bookingId: req.params.id,
        }),
      });
    }
  }

  res.json({ ok: true });
});

const adminMsgSchema = z.object({
  body:      z.string().optional(),
  photo_url: z.string().url().startsWith('https://').optional(),
  type:      z.enum(['message', 'update']),
});

router.post('/bookings/:id/messages', async (req: AuthRequest, res: Response) => {
  const parsed = adminMsgSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  if (!parsed.data.body && !parsed.data.photo_url) {
    res.status(400).json({ error: 'body or photo_url required' }); return;
  }

  const message = await MessageModel.createMessage({
    booking_id: req.params.id,
    sender_id: req.user!.userId,
    sender_role: 'admin',
    body: parsed.data.body,
    photo_url: parsed.data.photo_url,
    type: parsed.data.type,
  });

  getIo()?.to(`booking:${req.params.id}`).emit('message:new', message);

  const { rows } = await pool.query(
    'SELECT u.expo_push_token FROM bookings b JOIN users u ON u.id = b.owner_id WHERE b.id = $1',
    [req.params.id]
  );
  const pushToken = rows[0]?.expo_push_token;
  if (pushToken) {
    const title = parsed.data.type === 'update' ? '📸 Walk update' : '💬 New message from your walker';
    sendPush(pushToken, title, parsed.data.body ?? 'Photo update', { bookingId: req.params.id });
  }

  res.status(201).json(message);
});

// ── Slots ─────────────────────────────────────────────────────────────────

const slotSchema = z.object({
  service_id: z.string().uuid(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time:   z.string().regex(/^\d{2}:\d{2}$/),
  capacity:   z.number().int().positive().default(1),
});

const bulkSlotSchema = z.object({
  service_id:  z.string().uuid(),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1),
  start_time:  z.string().regex(/^\d{2}:\d{2}$/),
  end_time:    z.string().regex(/^\d{2}:\d{2}$/),
  capacity:    z.number().int().positive().default(1),
  from_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.get('/slots', async (req, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const slots = await BookingModel.getSlots(date);
  res.json(slots);
});

router.post('/slots', async (req, res: Response) => {
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const slot = await BookingModel.createSlot(parsed.data);
  res.status(201).json(slot);
});

router.post('/slots/bulk', async (req, res: Response) => {
  const parsed = bulkSlotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { service_id, days_of_week, start_time, end_time, capacity, from_date, to_date } = parsed.data;

  const created = [];
  const current = new Date(from_date + 'T00:00:00');
  const end = new Date(to_date + 'T00:00:00');

  while (current <= end) {
    if (days_of_week.includes(current.getDay())) {
      const dateStr = current.toISOString().slice(0, 10);
      const slot = await BookingModel.createSlot({ service_id, date: dateStr, start_time, end_time, capacity });
      created.push(slot);
    }
    current.setDate(current.getDate() + 1);
  }

  res.status(201).json({ created: created.length, slots: created });
});

router.delete('/slots/:id', async (req, res: Response) => {
  const ok = await BookingModel.deleteSlot(req.params.id);
  if (!ok) { res.status(404).json({ error: 'Slot not found' }); return; }
  res.json({ ok: true });
});

// ── Analytics ─────────────────────────────────────────────────────────────

router.get('/analytics', async (_req, res: Response) => {
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [revenueRes, trendsRes, topClientsRes, creditsRes] = await Promise.all([
    pool.query(`
      SELECT
        SUM(CASE WHEN type IN ('topup','subscription') THEN amount ELSE 0 END) AS credits_sold,
        SUM(CASE WHEN type = 'usage' THEN ABS(amount) ELSE 0 END) AS credits_used
      FROM wallet_transactions
      WHERE created_at >= date_trunc('month', NOW())
    `),
    pool.query(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             SUM(CASE WHEN type IN ('topup','subscription') THEN amount ELSE 0 END) AS credits_sold,
             COUNT(*) FILTER (WHERE type = 'usage') AS bookings
      FROM wallet_transactions
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `),
    pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name,
             COUNT(b.id) AS booking_count
      FROM users u
      JOIN bookings b ON b.owner_id = u.id
      WHERE b.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY u.id
      ORDER BY booking_count DESC
      LIMIT 10
    `),
    pool.query(`
      SELECT
        SUM(CASE WHEN type IN ('topup','subscription') THEN amount ELSE 0 END) AS total_credits_sold,
        SUM(CASE WHEN type = 'usage' THEN ABS(amount) ELSE 0 END) AS total_credits_used
      FROM wallet_transactions
    `),
  ]);

  res.json({
    this_month: revenueRes.rows[0],
    monthly_trends: trendsRes.rows,
    top_clients: topClientsRes.rows,
    all_time: creditsRes.rows[0],
  });
});

// ── Reviews ───────────────────────────────────────────────────────────────

router.get('/reviews', async (_req, res: Response) => {
  const { rows } = await pool.query(`
    SELECT r.*, u.first_name, u.last_name, u.email,
           d.name AS dog_name, b.id AS booking_id
    FROM reviews r
    JOIN users u ON u.id = r.owner_id
    JOIN bookings b ON b.id = r.booking_id
    JOIN dogs d ON d.id = b.dog_id
    ORDER BY r.created_at DESC
    LIMIT 100
  `);
  res.json(rows);
});

export default router;

// ── Helpers ────────────────────────────────────────────────────────────────

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
