import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';
import * as UserModel from '../models/user';
import { sendEmail } from '../utils/email';
import { welcomeEmail, passwordResetEmail } from '../utils/emailTemplates';

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  termsAccepted: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, firstName, lastName, termsAccepted } = parsed.data;
  const existing = await UserModel.findByEmail(email);
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.createUser(email, passwordHash, firstName, lastName, termsAccepted);

  const payload = { userId: user.id, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await UserModel.saveRefreshToken(user.id, tokenHash);

  // Send welcome email (non-blocking)
  sendEmail({
    to: email,
    subject: 'Welcome to Battersea K9!',
    html: welcomeEmail(firstName ?? null),
  });

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

async function issueTokensForUser(user: UserModel.User, res: Response) {
  const payload = { userId: user.id, role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await UserModel.saveRefreshToken(user.id, tokenHash);
  const { password_hash: _, ...safeUser } = user;
  res.json({ accessToken, refreshToken, user: safeUser });
}

router.post('/google', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) { res.status(400).json({ error: 'idToken required' }); return; }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) { res.status(401).json({ error: 'Invalid Google token' }); return; }

    const googleId = payload.sub;
    const email = payload.email ?? '';
    const firstName = payload.given_name ?? null;
    const lastName = payload.family_name ?? null;

    let user = await UserModel.findByGoogleId(googleId);
    if (!user && email) {
      user = await UserModel.findByEmail(email);
      if (user) {
        await UserModel.linkGoogleId(user.id, googleId);
        user = (await UserModel.findById(user.id))!;
      }
    }
    if (!user) {
      user = await UserModel.createOAuthUser({ email, firstName, lastName, googleId });
      sendEmail({ to: email, subject: 'Welcome to Battersea K9!', html: welcomeEmail(firstName) });
    }

    await issueTokensForUser(user, res);
  } catch (e) {
    console.error('Google auth error:', e);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

router.post('/apple', async (req: Request, res: Response) => {
  const { identityToken, fullName } = req.body;
  if (!identityToken) { res.status(400).json({ error: 'identityToken required' }); return; }

  try {
    const applePayload = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID ?? 'com.batterseak9.app',
      ignoreExpiration: false,
    });

    const appleId = applePayload.sub;
    const email = applePayload.email ?? '';
    const firstName = fullName?.givenName ?? null;
    const lastName = fullName?.familyName ?? null;

    let user = await UserModel.findByAppleId(appleId);
    if (!user && email) {
      user = await UserModel.findByEmail(email);
      if (user) {
        await UserModel.linkAppleId(user.id, appleId);
        user = (await UserModel.findById(user.id))!;
      }
    }
    if (!user) {
      user = await UserModel.createOAuthUser({ email, firstName, lastName, appleId });
      sendEmail({ to: email, subject: 'Welcome to Battersea K9!', html: welcomeEmail(firstName) });
    }

    await issueTokensForUser(user, res);
  } catch (e) {
    console.error('Apple auth error:', e);
    res.status(401).json({ error: 'Apple authentication failed' });
  }
});

// ── Password reset ─────────────────────────────────────────────────────────

const forgotSchema = z.object({ email: z.string().email() });

router.post('/forgot-password', async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  // Always return 200 to avoid email enumeration
  res.json({ ok: true });

  const user = await UserModel.findByEmail(parsed.data.email);
  if (!user) return;

  // Generate cryptographically secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await UserModel.savePasswordResetToken(user.id, tokenHash, expiresAt);

  const scheme = process.env.APP_SCHEME ?? 'k9app';
  const resetUrl = `${scheme}://reset-password?token=${rawToken}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset your Battersea K9 password',
    html: passwordResetEmail({ firstName: user.first_name, resetUrl }),
  });
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await UserModel.findPasswordResetToken(tokenHash);
  if (!record) { res.status(400).json({ error: 'Invalid or expired reset token.' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  await UserModel.updatePasswordHash(record.user_id, passwordHash);
  await UserModel.invalidatePasswordResetToken(tokenHash);

  // Invalidate all refresh tokens for security
  await UserModel.deleteAllRefreshTokensForUser(record.user_id);

  res.json({ ok: true });
});

export default router;
