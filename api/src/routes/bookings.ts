import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as BookingModel from '../models/booking';

const router = Router();

// ── Services ──────────────────────────────────────────────────────────────

router.get('/services', async (_req, res: Response) => {
  const services = await BookingModel.getServices();
  res.json(services);
});

// ── Availability ──────────────────────────────────────────────────────────

router.get('/availability', async (req, res: Response) => {
  const { date, from, to } = req.query as Record<string, string>;
  const slots = from && to
    ? await BookingModel.getSlotsInRange(from, to)
    : await BookingModel.getSlots(date);
  res.json(slots);
});

// ── Owner bookings ────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const bookings = await BookingModel.getBookingsByOwner(req.user!.userId);
  res.json(bookings);
});

router.get('/next', requireAuth, async (req: AuthRequest, res: Response) => {
  const booking = await BookingModel.getNextBooking(req.user!.userId);
  res.json(booking);
});

const createSchema = z.object({
  dog_id:  z.string().uuid(),
  slot_id: z.string().uuid(),
  notes:   z.string().optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  try {
    const booking = await BookingModel.createBooking({
      owner_id: req.user!.userId,
      ...parsed.data,
    });
    res.status(201).json(booking);
  } catch (e: any) {
    if (e.message === 'DOG_NOT_FOUND')          { res.status(403).json({ error: 'Dog not found or does not belong to you.' }); return; }
    if (e.message === 'INSUFFICIENT_CREDITS')   { res.status(402).json({ error: 'Insufficient credits. Please top up your wallet.' }); return; }
    if (e.message === 'SLOT_FULL')              { res.status(409).json({ error: 'This slot is fully booked.' }); return; }
    throw e;
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const cancelled = await BookingModel.cancelBooking(req.params.id, req.user!.userId);
  if (!cancelled) { res.status(404).json({ error: 'Booking not found or cannot be cancelled.' }); return; }
  res.json({ ok: true });
});

export default router;
