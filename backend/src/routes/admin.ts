import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { isAdmin, requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * GET /api/admin/me
 * Cheap admin-membership probe. Returns { admin: boolean } regardless of result.
 * Note: this route is BEFORE requireAdmin so non-admins get { admin: false } not 403.
 */
router.get('/me', async (req: Request, res: Response) => {
  res.json({ admin: await isAdmin(req.user!.id) });
});

router.use(requireAdmin);

/**
 * GET /api/admin/registrations
 * Paginated list. Query: ?limit=&offset=&status=
 */
router.get('/registrations', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    let query = supabase
      .from('registrations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data, count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/registrations/export.csv
 * CSV dump of all registrations.
 */
router.get('/registrations/export.csv', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
      res.send('');
      return;
    }

    const columns = Object.keys(rows[0]);
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      if (Array.isArray(v)) return `"${v.join('; ').replace(/"/g, '""')}"`;
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [
      columns.join(','),
      ...rows.map((row) => columns.map((c) => escape((row as Record<string, unknown>)[c])).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const DecisionSchema = z.object({
  status: z.enum(['submitted', 'approved', 'rejected', 'waitlisted']),
});
const RegistrationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * POST /api/admin/registrations/:id/decision
 * Sets the registration's status.
 */
router.post(
  '/registrations/:id/decision',
  validate({ params: RegistrationIdSchema, body: DecisionSchema }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: string };

      const { data, error } = await supabase
        .from('registrations')
        .update({ status })
        .eq('id', id)
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

// ─── Form configs ──────────────────────────────────────────────────────────

const FormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'dropdown', 'radio', 'checkbox', 'checkboxGroup', 'file', 'multipleChoiceGrid', 'preferenceGrid']),
  required: z.boolean(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  searchable: z.boolean().optional(),
  allowCustomValue: z.boolean().optional(),
  optionsSource: z.object({
    type: z.literal('csv'),
    url: z.string().url(),
    csvType: z.enum(['schools', 'countries']),
  }).optional(),
  checkboxText: z.string().optional(),
  linkUrl: z.string().optional(),
  linkText: z.string().optional(),
  accept: z.string().optional(),
  multiple: z.boolean().optional(),
  rows: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
}).passthrough();

const FormConfigUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema).optional(),
  is_active: z.boolean().optional(),
});

router.get('/form-configs', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('form_configs')
      .select('key, title, description, is_active, version, updated_at, fields')
      .order('updated_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Include a fields_count without sending the full payload to the list view.
    const summary = (data ?? []).map((row) => ({
      key: row.key,
      title: row.title,
      description: row.description,
      is_active: row.is_active,
      version: row.version,
      updated_at: row.updated_at,
      fields_count: Array.isArray(row.fields) ? row.fields.length : 0,
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const FormConfigCreateSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]+$/, 'key must be lowercase letters, numbers, and hyphens'),
  title: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema).default([]),
  is_active: z.boolean().default(false),
});

router.post(
  '/form-configs',
  validate({ body: FormConfigCreateSchema }),
  async (req: Request, res: Response) => {
    try {
      const { key, title, description, fields, is_active } = req.body;

      const { data: existing } = await supabase
        .from('form_configs')
        .select('key')
        .eq('key', key)
        .maybeSingle();
      if (existing) {
        res.status(409).json({ error: `Form with key '${key}' already exists` });
        return;
      }

      const { data, error } = await supabase
        .from('form_configs')
        .insert({
          key,
          title,
          description: description ?? '',
          fields,
          is_active,
          version: 1,
          updated_at: new Date().toISOString(),
          updated_by: req.user!.id,
        })
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

router.delete('/form-configs/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { error } = await supabase.from('form_configs').delete().eq('key', key);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/form-configs/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { data, error } = await supabase
      .from('form_configs')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Form config not found' });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put(
  '/form-configs/:key',
  validate({ body: FormConfigUpdateSchema }),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      const { data: existing, error: fetchError } = await supabase
        .from('form_configs')
        .select('version')
        .eq('key', key)
        .maybeSingle();

      if (fetchError) {
        res.status(500).json({ error: fetchError.message });
        return;
      }
      if (!existing) {
        res.status(404).json({ error: 'Form config not found' });
        return;
      }

      const updates: Record<string, unknown> = {
        ...req.body,
        version: existing.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: req.user!.id,
      };

      const { data, error } = await supabase
        .from('form_configs')
        .update(updates)
        .eq('key', key)
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

/**
 * GET /api/admin/metrics
 * Counts by status, school, and level_of_study.
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('registrations').select('status, school, level_of_study');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const total = data?.length ?? 0;
    const tally = (key: 'status' | 'school' | 'level_of_study') => {
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const k = (row as Record<string, string>)[key] ?? 'unknown';
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return counts;
    };

    res.json({
      total,
      by_status: tally('status'),
      by_school: tally('school'),
      by_level_of_study: tally('level_of_study'),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
