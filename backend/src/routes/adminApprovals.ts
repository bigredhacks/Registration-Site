import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { RegistrationStatusSchema } from '../types/registration';
import { buildApprovalCsv, filterApprovalStudents, resolveApprovalIdentities, type ApprovalStudent } from '../utils/adminApprovals';

// Mounted after requireAdmin in admin.ts.
const router = Router();
const columns = 'id,user_id,email,first_name,last_name,school,status,form_key,checked_in,checked_in_at,created_at,level_of_study,shirt_size';
const formKeySchema = z.string().trim().min(1).max(100);
const filtersSchema = z.object({
  form_key: formKeySchema,
  status: RegistrationStatusSchema.or(z.literal('')).optional(),
  q: z.string().max(300).optional(),
  checked_in: z.enum(['true', 'false', '']).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function loadStudents(formKey: string, allFields = false) {
  const rows: ApprovalStudent[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('registrations').select(allFields ? '*' : columns)
      .eq('form_key', formKey).order('id', { ascending: false }).range(offset, offset + 999);
    if (error) throw error;
    // Both projections contain these fields; the SDK cannot parse a union of select strings.
    rows.push(...((data ?? []) as unknown as ApprovalStudent[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

router.get(['/students', '/selection', '/export.csv'], async (req, res) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid registration filters.' }); return; }
  try {
    const { form_key, status, q, checked_in, offset, limit } = parsed.data;
    const rows = filterApprovalStudents(await loadStudents(form_key, req.path === '/export.csv'), { status, search: q, checkedIn: checked_in });
    if (req.path === '/export.csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
      res.send(buildApprovalCsv(rows as unknown as Record<string, unknown>[]));
      return;
    }
    res.json({ data: req.path === '/selection' ? rows : rows.slice(offset, offset + limit), count: rows.length });
  } catch {
    res.status(500).json({ error: 'Could not load registrations.' });
  }
});

router.post('/resolve', validate({ body: z.object({
  form_key: formKeySchema,
  entries: z.array(z.string().trim().min(1).max(300)).min(1).max(500),
}) }), async (req, res) => {
  try {
    const matches = resolveApprovalIdentities(await loadStudents(req.body.form_key), req.body.entries);
    res.json({ matches });
  } catch {
    res.status(500).json({ error: 'Could not match students.' });
  }
});

router.post('/decision', validate({ body: z.object({
  form_key: formKeySchema,
  ids: z.array(z.number().int().positive()).min(1).max(200),
  status: RegistrationStatusSchema,
}) }), async (req, res) => {
  try {
    const { form_key, ids, status } = req.body as { form_key: string; ids: number[]; status: string };
    const { data, error } = await supabase.from('registrations').update({ status })
      .eq('form_key', form_key).in('id', [...new Set(ids)]).select(columns);
    if (error) { res.status(500).json({ error: 'Could not update selected students.' }); return; }
    // Return actual rows so a deleted/moved registration stays selected for review.
    res.json({ data: data ?? [] });
  } catch {
    res.status(500).json({ error: 'Could not update selected students.' });
  }
});

export default router;
