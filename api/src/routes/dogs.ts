import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as DogModel from '../models/dog';

const router = Router();

const dogSchema = z.object({
  name:               z.string().min(1),
  breed:              z.string().optional(),
  age_months:         z.number().int().positive().optional(),
  notes:              z.string().optional(),
  vet_name:           z.string().optional(),
  vet_phone:          z.string().optional(),
  medical_notes:      z.string().optional(),
  behavioural_notes:  z.string().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const dogs = await DogModel.getDogsByOwner(req.user!.userId);
  res.json(dogs);
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = dogSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const dog = await DogModel.createDog(req.user!.userId, parsed.data);
  res.status(201).json(dog);
});

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = dogSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const dog = await DogModel.updateDog(req.params.id, req.user!.userId, parsed.data);
  if (!dog) { res.status(404).json({ error: 'Dog not found' }); return; }
  res.json(dog);
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const deleted = await DogModel.deleteDog(req.params.id, req.user!.userId);
  if (!deleted) { res.status(404).json({ error: 'Dog not found' }); return; }
  res.json({ ok: true });
});

export default router;
