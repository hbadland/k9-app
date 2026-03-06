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

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/clients', async (_req, res: Response) => {
  const clients = await DogModel.getAllClientsWithDogs();
  res.json(clients);
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

  // Drive location simulator
  const { rows } = await pool.query(
    'SELECT b.dog_id, u.expo_push_token FROM bookings b JOIN users u ON u.id = b.owner_id WHERE b.id = $1',
    [req.params.id]
  );
  const dogId = rows[0]?.dog_id;
  if (dogId) {
    if (parsed.data.status === 'in_progress') simulator.start(dogId, req.params.id);
    else if (['completed', 'cancelled'].includes(parsed.data.status)) simulator.stop(dogId);
  }

  // Push notification to owner
  const pushToken = rows[0]?.expo_push_token;
  if (pushToken) {
    if (parsed.data.status === 'in_progress') {
      sendPush(pushToken, '🐾 Walk started!', 'Your dog is on their way', { bookingId: req.params.id });
    } else if (parsed.data.status === 'completed') {
      sendPush(pushToken, '✅ Walk complete', 'Check the walk report', { bookingId: req.params.id });
    }
  }

  res.json({ ok: true });
});

const adminMsgSchema = z.object({
  body:      z.string().optional(),
  photo_url: z.string().optional(),
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

  // Push to owner
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

router.delete('/slots/:id', async (req, res: Response) => {
  const ok = await BookingModel.deleteSlot(req.params.id);
  if (!ok) { res.status(404).json({ error: 'Slot not found' }); return; }
  res.json({ ok: true });
});

export default router;
