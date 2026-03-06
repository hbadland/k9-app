import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as UserModel from '../models/user';
import { pool } from '../config/db';

const router = Router();

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

export default router;
