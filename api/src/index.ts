import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to known origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, health checks)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Stripe webhook needs raw body — must be registered before express.json()
app.post('/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());

// Rate limiting — tight on auth, loose on everything else
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
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

// ── Socket.io ─────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const payload = verifyAccess(token);
    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

setIo(io);

io.on('connection', (socket) => {
  socket.on('subscribe:dog', ({ dogId }: { dogId: string }) => {
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
});

simulator.init(io);

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
