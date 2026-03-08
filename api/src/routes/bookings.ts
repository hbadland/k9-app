import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as BookingModel from '../models/booking';
import * as UserModel from '../models/user';
import messagesRouter from './messages';
import { sendEmail } from '../utils/email';
import { bookingConfirmationEmail, bookingCancellationEmail } from '../utils/emailTemplates';
import { pool } from '../config/db';

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

    // Send confirmation email (non-blocking)
    const user = await UserModel.findById(req.user!.userId);
    if (user && booking.dog_name && booking.slot_date) {
      sendEmail({
        to: user.email,
        subject: `Booking confirmed — ${booking.dog_name}'s walk`,
        html: bookingConfirmationEmail({
          firstName: user.first_name,
          dogName: booking.dog_name,
          serviceName: booking.service_name ?? 'Walk',
          slotDate: booking.slot_date,
          slotStart: booking.slot_start ?? '',
          slotEnd: booking.slot_end ?? '',
          bookingId: booking.id,
        }),
      });
    }
  } catch (e: any) {
    if (e.message === 'DOG_NOT_FOUND')          { res.status(403).json({ error: 'Dog not found or does not belong to you.' }); return; }
    if (e.message === 'INSUFFICIENT_CREDITS')   { res.status(402).json({ error: 'Insufficient credits. Please top up your wallet.' }); return; }
    if (e.message === 'SLOT_FULL')              { res.status(409).json({ error: 'This slot is fully booked.' }); return; }
    throw e;
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const booking = await BookingModel.getBookingById(req.params.id, req.user!.userId);
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
  res.json(booking);
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const result = await BookingModel.cancelBooking(req.params.id, req.user!.userId);
  if (!result) { res.status(404).json({ error: 'Booking not found or cannot be cancelled.' }); return; }
  res.json({ ok: true, refunded: result.refunded });

  // Send cancellation email (non-blocking)
  const user = await UserModel.findById(req.user!.userId);
  if (user && result.booking) {
    sendEmail({
      to: user.email,
      subject: `Booking cancelled — ${result.booking.dog_name}`,
      html: bookingCancellationEmail({
        firstName: user.first_name,
        dogName: result.booking.dog_name ?? '',
        serviceName: result.booking.service_name ?? 'Walk',
        slotDate: result.booking.slot_date ?? '',
        slotStart: result.booking.slot_start ?? '',
        refunded: result.refunded,
      }),
    });
  }
});

// ── Walk report ───────────────────────────────────────────────────────────

router.get('/:id/report', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT wr.* FROM walk_reports wr
     JOIN bookings b ON b.id = wr.booking_id
     WHERE wr.booking_id = $1 AND b.owner_id = $2`,
    [req.params.id, req.user!.userId]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Walk report not found' }); return; }
  res.json(rows[0]);
});

// ── Walk locations (GPS history) ──────────────────────────────────────────

router.get('/:id/locations', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(
    `SELECT dl.latitude, dl.longitude, dl.accuracy, dl.recorded_at
     FROM dog_locations dl
     JOIN bookings b ON b.id = dl.booking_id
     WHERE dl.booking_id = $1 AND b.owner_id = $2
     ORDER BY dl.recorded_at ASC`,
    [req.params.id, req.user!.userId]
  );
  res.json(rows);
});

// ── Reviews ───────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

router.post('/:id/review', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const booking = await BookingModel.getBookingById(req.params.id, req.user!.userId);
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
  if (booking.status !== 'completed') { res.status(400).json({ error: 'Can only review completed walks' }); return; }

  try {
    const { rows } = await pool.query(
      `INSERT INTO reviews (booking_id, owner_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user!.userId, parsed.data.rating, parsed.data.comment ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') { res.status(409).json({ error: 'You have already reviewed this walk' }); return; }
    throw e;
  }
});

router.use('/:bookingId/messages', messagesRouter);

export default router;
