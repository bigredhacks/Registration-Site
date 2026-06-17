import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
