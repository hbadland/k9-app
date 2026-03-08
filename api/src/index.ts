import 'dotenv/config';

// ── Env validation — fail fast ─────────────────────────────────────────────
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('[startup] Missing required environment variables:', missing.join(', '));
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.warn('[startup] RESEND_API_KEY not set — transactional emails will be skipped');
}

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { Server } from 'socket.io';
import authRouter from './routes/auth';
import meRouter from './routes/me';
import dogsRouter from './routes/dogs';
import adminRouter from './routes/admin';
import bookingsRouter from './routes/bookings';
import paymentsRouter, { webhookHandler } from './routes/payments';
import { verifyAccess } from './utils/jwt';
import { simulator } from './services/locationSimulator';
import { setIo } from './config/io';
import { startReminderJob } from './services/reminderJob';
import { pool } from './config/db';

// ── Sentry ─────────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 });
}

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to known origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Stripe webhook needs raw body — must be registered before express.json()
app.post('/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use('/auth', authLimiter, authRouter);
app.use('/me', meRouter);
app.use('/dogs', dogsRouter);
app.use('/admin', adminRouter);
app.use('/bookings', bookingsRouter);
app.use('/payments', paymentsRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Sentry error handler (must be after routes)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler — catches unhandled errors from async route handlers
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal server error' });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

// Rate limiting per socket: max 60 events / 10s
const socketEventCounts = new Map<string, { count: number; resetAt: number }>();
const SOCKET_RATE_LIMIT = 60;
const SOCKET_RATE_WINDOW_MS = 10_000;

function isSocketRateLimited(socketId: string): boolean {
  const now = Date.now();
  const entry = socketEventCounts.get(socketId);
  if (!entry || now > entry.resetAt) {
    socketEventCounts.set(socketId, { count: 1, resetAt: now + SOCKET_RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > SOCKET_RATE_LIMIT) return true;
  return false;
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const payload = verifyAccess(token);
    socket.data.userId = payload.userId;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

setIo(io);

io.on('connection', (socket) => {
  socket.on('subscribe:dog', ({ dogId }: { dogId: string }) => {
    if (isSocketRateLimited(socket.id)) return;
    socket.join(`dog:${dogId}`);
    socket.emit('walk:status', { active: simulator.isActive(dogId) });
  });
  socket.on('unsubscribe:dog', ({ dogId }: { dogId: string }) => {
    socket.leave(`dog:${dogId}`);
  });
  socket.on('subscribe:booking', ({ bookingId }: { bookingId: string }) => {
    socket.join(`booking:${bookingId}`);
  });
  socket.on('unsubscribe:booking', ({ bookingId }: { bookingId: string }) => {
    socket.leave(`booking:${bookingId}`);
  });

  // Real GPS from admin dashboard (admin-only)
  socket.on('location:push', async (data: { dogId: string; bookingId: string; lat: number; lng: number; accuracy?: number }) => {
    if (isSocketRateLimited(socket.id)) {
      socket.disconnect(true);
      return;
    }
    if (socket.data.role !== 'admin') return;
    const { dogId, bookingId, lat, lng, accuracy } = data;
    if (!dogId || !bookingId || typeof lat !== 'number' || typeof lng !== 'number') return;

    // Broadcast to subscribers
    io.to(`dog:${dogId}`).emit('location:update', { lat, lng, accuracy });

    // Persist to walk_locations
    try {
      await pool.query(
        'INSERT INTO dog_locations (dog_id, booking_id, latitude, longitude, accuracy) VALUES ($1,$2,$3,$4,$5)',
        [dogId, bookingId, lat, lng, accuracy ?? null]
      );
    } catch (err) {
      console.error('[location:push] DB insert error:', err);
    }
  });

  socket.on('disconnect', () => {
    socketEventCounts.delete(socket.id);
  });
});

const USE_SIMULATOR = process.env.USE_SIMULATOR === 'true';
if (USE_SIMULATOR) {
  simulator.init(io);
}

// ── Start ─────────────────────────────────────────────────────────────────
startReminderJob();

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
