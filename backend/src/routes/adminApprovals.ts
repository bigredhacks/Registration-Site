import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { RegistrationStatusSchema } from '../types/registration';
import { approvalAnswerValue, approvalFilterFields, buildApprovalCsv, filterApprovalStudents, resolveApprovalIdentities, type ApprovalStudent } from '../utils/adminApprovals';

// Mounted after requireAdmin in admin.ts.
const router = Router();
const columns = 'id,user_id,email,first_name,last_name,school,status,form_key,checked_in,checked_in_at,created_at,level_of_study,shirt_size';
const formKeySchema = z.string().trim().min(1).max(100);
const filtersSchema = z.object({
  form_key: formKeySchema,
  status: RegistrationStatusSchema.or(z.literal('')).optional(),
  q: z.string().max(300).optional(),
  checked_in: z.enum(['true', 'false', '']).optional(),
  answers: z.string().max(30000).transform((value, ctx) => {
    try { return JSON.parse(value); }
    catch { ctx.addIssue({ code: 'custom', message: 'Invalid answer filters.' }); return z.NEVER; }
  }).pipe(z.array(z.object({
    field: z.string().min(1).max(300), row: z.string().min(1).max(500).optional(),
    operator: z.enum(['is', 'is_not', 'contains', 'not_contains', 'empty', 'not_empty', 'gt', 'gte', 'lt', 'lte']),
    values: z.array(z.string().trim().min(1).max(2000)).max(100).optional(),
  }).superRefine((filter, ctx) => {
    if (['empty', 'not_empty'].includes(filter.operator)) return;
    if (!filter.values?.length || (!['is', 'is_not'].includes(filter.operator) && filter.values.length !== 1)) {
      ctx.addIssue({ code: 'custom', message: 'Choose a filter value.' });
    }
    if (['gt', 'gte', 'lt', 'lte'].includes(filter.operator) && !Number.isFinite(Number(filter.values?.[0]))) {
      ctx.addIssue({ code: 'custom', message: 'Enter a number.' });
    }
  })).max(30)).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function loadStudents(formKey: string, allFields = false) {
  const rows: ApprovalStudent[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('registrations').select(allFields ? '*' : `${columns},age,major,answers`)
      .eq('form_key', formKey).order('id', { ascending: false }).range(offset, offset + 999);
    if (error) throw error;
    // Both projections contain these fields; the SDK cannot parse a union of select strings.
    rows.push(...((data ?? []) as unknown as ApprovalStudent[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function studentSummary(row: ApprovalStudent) {
  const { answers: _answers, ...summary } = row;
  const school = approvalAnswerValue(row, 'school');
  return { ...summary, school: typeof school === 'string' ? school : null };
}

router.get(['/students', '/selection', '/export.csv'], async (req, res) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid registration filters.' }); return; }
  try {
    const { form_key, status, q, checked_in, offset, limit, answers } = parsed.data;
    const allRows = await loadStudents(form_key, req.path === '/export.csv');
    const { data: config, error: configError } = await supabase.from('form_configs').select('fields').eq('key', form_key).maybeSingle();
    if (configError) throw configError;
    const fields = approvalFilterFields(allRows, Array.isArray(config?.fields) ? config.fields : []);
    if (answers?.some(filter => !fields.some(field => field.field === filter.field && field.row === filter.row))) {
      res.status(400).json({ error: 'A filtered question is no longer available. Remove it and try again.' }); return;
    }
    const rows = filterApprovalStudents(allRows, { status, search: q, checkedIn: checked_in, answers });
    if (req.path === '/export.csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
      res.send(buildApprovalCsv(rows as unknown as Record<string, unknown>[]));
      return;
    }
    const data = (req.path === '/selection' ? rows : rows.slice(offset, offset + limit)).map(studentSummary);
    res.json({ data, count: rows.length, ...(req.path === '/students' ? { fields } : {}) });
  } catch {
    res.status(500).json({ error: 'Could not load registrations.' });
  }
});

router.post('/resolve', validate({ body: z.object({
  form_key: formKeySchema,
  entries: z.array(z.string().trim().min(1).max(300)).min(1).max(500),
}) }), async (req, res) => {
  try {
    const matches = resolveApprovalIdentities((await loadStudents(req.body.form_key)).map(studentSummary), req.body.entries);
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
