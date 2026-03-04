import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import meRouter from './routes/me';
import dogsRouter from './routes/dogs';
import adminRouter from './routes/admin';
import bookingsRouter from './routes/bookings';
import paymentsRouter, { webhookHandler } from './routes/payments';

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

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
