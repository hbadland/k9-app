import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireRole = (role: string) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
