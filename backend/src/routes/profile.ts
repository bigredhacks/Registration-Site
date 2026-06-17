import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UpdateProfileBody, UpdateProfileSchema } from '../types/profile';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/profile
 * Returns the authenticated user's profile, creating an empty row on first access.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({ id: req.user!.id })
        .select()
        .single();

      if (createError) {
        res.status(500).json({ error: createError.message });
        return;
      }
      res.json(created);
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/profile
 * Upserts the authenticated user's profile with any subset of allowed fields.
 */
router.put(
  '/',
  validate({ body: UpdateProfileSchema }),
  async (req: Request<{}, {}, UpdateProfileBody>, res: Response) => {
    try {
      const updates = { id: req.user!.id, ...req.body };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' })
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
  }
);

export default router;
