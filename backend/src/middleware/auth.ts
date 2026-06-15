import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Express middleware that verifies the Supabase JWT from the Authorization header.
 * On success, attaches the authenticated user to req.user.
 * Returns 401 if the token is missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = data.user;
  next();
}
