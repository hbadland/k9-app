import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as DogModel from '../models/dog';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function getS3(): S3Client | null {
  if (!process.env.R2_ACCOUNT_ID) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

async function uploadToStorage(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const s3 = getS3();
  if (!s3) throw new Error('CDN_NOT_CONFIGURED');
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET ?? '',
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return `${process.env.R2_PUBLIC_URL ?? ''}/${key}`;
}

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
  avatar_url:         z.string().optional(),
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

router.post('/:id/avatar', requireAuth, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'avatar file required' }); return; }
  // Verify dog ownership
  const dog = await DogModel.getDogById(req.params.id, req.user!.userId);
  if (!dog) { res.status(404).json({ error: 'Dog not found' }); return; }
  try {
    const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
    const key = `avatars/dogs/${req.params.id}-${Date.now()}.${ext}`;
    const url = await uploadToStorage(req.file.buffer, key, req.file.mimetype);
    const updated = await DogModel.updateDog(req.params.id, req.user!.userId, { avatar_url: url });
    res.json({ avatar_url: url, dog: updated });
  } catch (e: any) {
    if (e.message === 'CDN_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Image storage not configured. Set R2_* environment variables.' });
      return;
    }
    throw e;
  }
});

export default router;
