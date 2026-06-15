import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All routes in this file require authentication
router.use(requireAuth);

/**
 * GET /api/profile
 * Returns the authenticated user's profile.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/profile
 * Updates the authenticated user's profile.
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const { full_name, avatar_url } = req.body;

    const updates: Record<string, string> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'At least one field is required' });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
