import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  CreateParticipantBody,
  CreateParticipantSchema,
  ParticipantParamsSchema,
} from '../types/participant';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * POST /api/participants
 *
 * Creates a new participant for team matching.
 */
router.post(
  '/',
  validate({ body: CreateParticipantSchema }),
  async (req: Request<{}, {}, CreateParticipantBody>, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .insert(req.body)
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
 *
 * Lists participants, optionally filtered by pool_id query param.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
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
 *
 * Deletes a participant by UUID.
 */
router.delete(
  '/:id',
  validate({ params: ParticipantParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', id);

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
