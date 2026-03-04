import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import * as DogModel from '../models/dog';
import * as UserModel from '../models/user';
import * as BookingModel from '../models/booking';

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

const bookingStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']),
});

router.patch('/bookings/:id/status', async (req, res: Response) => {
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const ok = await BookingModel.updateBookingStatus(req.params.id, parsed.data.status);
  if (!ok) { res.status(404).json({ error: 'Booking not found' }); return; }
  res.json({ ok: true });
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
