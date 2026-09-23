import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';

const router = Router();
const formKey = z.string().trim().min(1).max(100).default('registration');
const optionalDate = z.union([z.iso.date(), z.literal('')]).optional();
const filtersSchema = z.object({
  form_key: formKey,
  q: z.string().trim().max(300).optional(),
  profile_state: z.enum(['not_started', 'incomplete', 'complete', '']).optional(),
  submitted: z.enum(['true', 'false', '']).optional(),
  email_verified: z.enum(['true', 'false', '']).optional(),
  from: optionalDate,
  to: optionalDate,
  sort: z.enum(['name', 'school', 'created_at']).default('created_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
}).refine(value => !value.from || !value.to || value.from <= value.to);

router.get('/', async (req, res) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid user filters.' }); return; }
  const filters = parsed.data;
  try {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_form_key: filters.form_key,
      p_q: filters.q || null,
      p_profile_state: filters.profile_state || null,
      p_submitted: filters.submitted ? filters.submitted === 'true' : null,
      p_email_verified: filters.email_verified ? filters.email_verified === 'true' : null,
      p_from: filters.from || null,
      p_to: filters.to || null,
      p_sort: filters.sort,
      p_dir: filters.dir,
      p_limit: filters.limit,
      p_offset: filters.offset,
    });
    if (error) throw error;
    res.json({ ...data, limit: filters.limit, offset: filters.offset });
  } catch {
    res.status(500).json({ error: 'Could not load users.' });
  }
});

router.get('/:userId', async (req, res) => {
  const id = z.uuid().safeParse(req.params.userId);
  const query = z.object({ form_key: formKey }).safeParse(req.query);
  if (!id.success || !query.success) { res.status(400).json({ error: 'Invalid user request.' }); return; }
  try {
    const { data, error } = await supabase.rpc('admin_user_detail', {
      p_user_id: id.data, p_form_key: query.data.form_key,
    });
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'User not found.' }); return; }
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Could not load this user.' });
  }
});

export default router;
