import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { registrationClosureResponse } from '../utils/registrationClosure';

const router = Router();

/**
 * GET /api/form-configs
 * Authenticated users can fetch active form summaries for discovery.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('form_configs')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const now = Date.now();
    res.json((data ?? []).map((form) => registrationClosureResponse({
      key: form.key, title: form.title, description: form.description, version: form.version,
      closes_at: form.closes_at, closes_timezone: form.closes_timezone,
    }, now)));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/form-configs/:key
 * Authenticated users can fetch active form configs.
 */
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const { data, error } = await supabase
      .from('form_configs')
      .select('*')
      .eq('key', key)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Form config not found' });
      return;
    }

    res.json(registrationClosureResponse(data));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
