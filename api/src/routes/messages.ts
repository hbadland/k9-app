import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { pool } from '../config/db';
import { getIo } from '../config/io';
import * as MessageModel from '../models/message';

// Mounted with mergeParams: true at /bookings/:bookingId/messages
const router = Router({ mergeParams: true });

// Verify caller owns the booking
async function ownerOwnsBooking(bookingId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM bookings WHERE id=$1 AND owner_id=$2',
    [bookingId, userId]
  );
  return (rowCount ?? 0) > 0;
}

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { bookingId } = req.params as { bookingId: string };
  const ok = await ownerOwnsBooking(bookingId, req.user!.userId);
  if (!ok) { res.status(403).json({ error: 'Forbidden' }); return; }
  const messages = await MessageModel.getMessages(bookingId);
  res.json(messages);
});

const msgSchema = z.object({ body: z.string().min(1) });

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { bookingId } = req.params as { bookingId: string };
  const ok = await ownerOwnsBooking(bookingId, req.user!.userId);
  if (!ok) { res.status(403).json({ error: 'Forbidden' }); return; }

  const parsed = msgSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const message = await MessageModel.createMessage({
    booking_id: bookingId,
    sender_id: req.user!.userId,
    sender_role: 'owner',
    body: parsed.data.body,
    type: 'message',
  });

  getIo()?.to(`booking:${bookingId}`).emit('message:new', message);
  res.status(201).json(message);
});

export default router;
