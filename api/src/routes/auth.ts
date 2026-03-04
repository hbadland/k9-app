import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';
import * as UserModel from '../models/user';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, firstName, lastName } = parsed.data;
  const existing = await UserModel.findByEmail(email);
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.createUser(email, passwordHash, firstName, lastName);

  const payload = { userId: user.id, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await UserModel.saveRefreshToken(user.id, tokenHash);

  const { password_hash: _, ...safeUser } = user;
  res.status(201).json({ accessToken, refreshToken, user: safeUser });
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password } = parsed.data;
  const user = await UserModel.findByEmail(email);
  if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const payload = { userId: user.id, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await UserModel.saveRefreshToken(user.id, tokenHash);

  const { password_hash: _, ...safeUser } = user;
  res.json({ accessToken, refreshToken, user: safeUser });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(400).json({ error: 'Refresh token required' }); return; }

  try {
    const payload = verifyRefresh(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await UserModel.findRefreshToken(tokenHash);
    if (!stored) { res.status(401).json({ error: 'Invalid refresh token' }); return; }

    await UserModel.deleteRefreshToken(tokenHash);

    const newAccess = signAccess({ userId: payload.userId, role: payload.role });
    const newRefresh = signRefresh({ userId: payload.userId, role: payload.role });
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    await UserModel.saveRefreshToken(payload.userId, newHash);

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await UserModel.deleteRefreshToken(tokenHash);
  }
  res.json({ ok: true });
});

export default router;
