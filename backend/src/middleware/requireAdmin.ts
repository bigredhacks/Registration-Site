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

/**
 * Resolves a row by primary key on `table`, then enforces caller-is-owner or
 * caller-is-admin. Writes the appropriate error response and returns null on
 * failure; returns the row on success. Routes call this once at the top of
 * the handler instead of repeating the fetch + isOwner + isAdmin dance.
 */
export async function resolveOwnerOrAdmin<T extends { user_id: string }>(
  table: string,
  id: string | number,
  req: Request,
  res: Response,
  selectColumns = '*',
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select(selectColumns)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  const row = data as unknown as T;
  const isOwner = row.user_id === req.user!.id;
  if (!isOwner && !(await isAdmin(req.user!.id))) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return row;
}
