import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  CreateParticipantBody,
  CreateParticipantSchema,
  ParticipantParamsSchema,
  UpdateParticipantBody,
  UpdateParticipantSchema,
} from '../types/participant';
import { validate } from '../middleware/validate';
import { isAdmin, resolveOwnerOrAdmin } from '../middleware/requireAdmin';

const router = Router();

/**
 * GET /api/participants/me
 * Returns the caller's team-matching submission for the given pool (default 'default').
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const poolId = (req.query.pool_id as string) || 'default';

    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('pool_id', poolId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'No submission found' });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/participants/me
 * Updates the caller's team-matching submission in-place.
 */
router.put(
  '/me',
  validate({ body: UpdateParticipantSchema }),
  async (req: Request<{}, {}, UpdateParticipantBody>, res: Response) => {
    try {
      const poolId = (req.query.pool_id as string) || 'default';

      const { data, error } = await supabase
        .from('participants')
        .update(req.body)
        .eq('user_id', req.user!.id)
        .eq('pool_id', poolId)
        .select()
        .single();

      if (error) {
        res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/participants
 * Upsert: creates or updates the caller's submission for (user_id, pool_id).
 */
router.post(
  '/',
  validate({ body: CreateParticipantSchema }),
  async (req: Request<{}, {}, CreateParticipantBody>, res: Response) => {
    try {
      const payload = { ...req.body, user_id: req.user!.id };

      const { data, error } = await supabase
        .from('participants')
        .upsert(payload, { onConflict: 'user_id,pool_id' })
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json(data);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/participants
 * Admin-only: list participants in a pool.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req.user!.id))) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const poolId = (req.query.pool_id as string) || 'default';

    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false });

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
 * DELETE /api/participants/:id
 * Owner or admin only.
 */
router.delete(
  '/:id',
  validate({ params: ParticipantParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const owned = await resolveOwnerOrAdmin('participants', req.params.id, req, res, 'user_id');
      if (!owned) return;

      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', req.params.id);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
