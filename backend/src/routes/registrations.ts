import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  RegistrationParamsSchema,
} from '../types/registration';
import { validate } from '../middleware/validate';
import { isAdmin, resolveOwnerOrAdmin } from '../middleware/requireAdmin';
import { sendRegistrationConfirmation } from '../utils/email';
import {
  buildAnswersSchema,
  projectRegistrationColumns,
  type DynamicFormField,
} from '../utils/registrationForms';

const router = Router();

type RegistrationRow = {
  id: number | string;
  user_id: string;
  email: string | null;
  form_key?: string | null;
  form_version?: number | null;
  answers?: Record<string, unknown> | null;
  resume_path?: string | null;
  status?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  age?: string | null;
  phone_number?: string | null;
  linkedin?: string | null;
  school?: string | null;
  country?: string | null;
  level_of_study?: string | null;
  major?: string | null;
  gender?: string | null;
  dietary_restrictions?: string[] | null;
  shirt_size?: string | null;
  mlh_code_of_conduct?: boolean | null;
  mlh_data_sharing_consent?: boolean | null;
  mlh_emails_opt_in?: boolean | null;
};

type FormConfigRow = {
  key: string;
  title: string;
  version: number;
  fields: DynamicFormField[];
};

function getFormKey(req: Request): string {
  const value = req.query.form_key;
  return typeof value === 'string' && value.trim() ? value.trim() : 'registration';
}

async function getUserFormConfig(formKey: string): Promise<FormConfigRow | null> {
  const { data, error } = await supabase
    .from('form_configs')
    .select('key, title, version, fields')
    .eq('key', formKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as FormConfigRow | null;
}

function legacyAnswersFromRow(row: Partial<RegistrationRow>): Record<string, unknown> {
  return {
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    age: row.age ?? '',
    phone_number: row.phone_number ?? '',
    email: row.email ?? '',
    linkedin: row.linkedin ?? '',
    school: row.school ?? '',
    country: row.country ?? '',
    level_of_study: row.level_of_study ?? '',
    major: row.major ?? '',
    gender: row.gender ?? '',
    dietary_restrictions: row.dietary_restrictions ?? [],
    shirt_size: row.shirt_size ?? '',
    mlh_code_of_conduct: row.mlh_code_of_conduct ?? false,
    mlh_data_sharing_consent: row.mlh_data_sharing_consent ?? false,
    mlh_emails_opt_in: row.mlh_emails_opt_in ?? false,
  };
}

function toRegistrationResponse(row: RegistrationRow) {
  const persistedAnswers =
    row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers)
      ? row.answers
      : {};

  return {
    ...row,
    form_key: row.form_key ?? 'registration',
    form_version: row.form_version ?? 1,
    answers: {
      ...legacyAnswersFromRow(row),
      ...persistedAnswers,
    },
  };
}

async function parseAnswersFromBody(
  req: Request,
  formKey: string,
  rawBody: Record<string, unknown> = req.body ?? {},
) {
  const formConfig = await getUserFormConfig(formKey);
  if (!formConfig) {
    return {
      status: 404 as const,
      body: { error: `Active form "${formKey}" not found` },
    };
  }

  const schema = buildAnswersSchema(formConfig.fields);
  const parsed = schema.safeParse(rawBody);

  if (!parsed.success) {
    return {
      status: 400 as const,
      body: {
        error: 'Invalid form submission',
        errors: parsed.error.issues.map((issue) => ({
          field: String(issue.path[0] ?? 'form'),
          message: issue.message,
        })),
      },
    };
  }

  return {
    status: 200 as const,
    formConfig,
    answers: parsed.data,
  };
}

/**
 * POST /api/registrations/me/resume-upload-url
 * Issues a signed upload URL so the browser can PUT the resume directly to Storage.
 * Body: { filename: string }  (basename only; the user_id is enforced server-side)
 */
router.post('/me/resume-upload-url', async (req: Request, res: Response) => {
  try {
    const filename = String(req.body?.filename || 'resume.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
    const objectPath = `${req.user!.id}/${filename}`;

    const { data, error } = await supabase
      .storage
      .from('resumes')
      .createSignedUploadUrl(objectPath);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ...data, path: objectPath });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/registrations/me/resume
 * Persists the storage path of the uploaded resume on the caller's registration.
 * Body: { resume_path: string }
 */
router.post('/me/resume', async (req: Request, res: Response) => {
  try {
    const resumePath = String(req.body?.resume_path || '');
    const formKey = getFormKey(req);
    if (!resumePath.startsWith(`${req.user!.id}/`)) {
      res.status(400).json({ error: 'resume_path must be inside the caller\'s folder' });
      return;
    }

    const { data, error } = await supabase
      .from('registrations')
      .update({ resume_path: resumePath })
      .eq('user_id', req.user!.id)
      .eq('form_key', formKey)
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
});

/**
 * GET /api/registrations/me/resume-download-url
 * Returns a short-lived signed URL the caller can use to download their resume.
 */
router.get('/me/resume-download-url', async (req: Request, res: Response) => {
  try {
    const formKey = getFormKey(req);
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('resume_path')
      .eq('user_id', req.user!.id)
      .eq('form_key', formKey)
      .maybeSingle();

    if (regError) {
      res.status(500).json({ error: regError.message });
      return;
    }
    if (!registration?.resume_path) {
      res.status(404).json({ error: 'No resume uploaded' });
      return;
    }

    const { data, error } = await supabase
      .storage
      .from('resumes')
      .createSignedUrl(registration.resume_path, 60 * 5);

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
 * GET /api/registrations/me
 * Returns the authenticated user's registration, or 404.
 * Defined before /:id so the literal route wins.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const formKey = getFormKey(req);
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('form_key', formKey)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'No registration found' });
      return;
    }

    res.json(toRegistrationResponse(data as RegistrationRow));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/registrations
 * Creates a registration owned by the authenticated user.
 * Returns 409 if the user already has one.
 */
router.post('/', async (req: Request<{}, {}, Record<string, unknown>>, res: Response) => {
  try {
    const formKey = getFormKey(req);
    const parsed = await parseAnswersFromBody(req, formKey);
    if (parsed.status !== 200) {
      res.status(parsed.status).json(parsed.body);
      return;
    }

    const { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('form_key', formKey)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: 'Registration already exists for this user and form' });
      return;
    }

    const projected = projectRegistrationColumns(parsed.answers, req.user!);
    const payload = {
      user_id: req.user!.id,
      form_key: formKey,
      form_version: parsed.formConfig.version,
      answers: parsed.answers,
      status: 'pending',
      ...projected,
      email: req.user!.email ?? null,
    };

    const { data, error } = await supabase
      .from('registrations')
      .insert(payload)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    sendRegistrationConfirmation({
      to: data.email,
      firstName: data.first_name,
    }).catch((e) => console.error('[email] confirmation failed:', e));

    res.status(201).json(toRegistrationResponse(data as RegistrationRow));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/registrations/me
 * Updates the authenticated user's submission for a specific form_key.
 */
router.put('/me', async (req: Request<{}, {}, Record<string, unknown>>, res: Response) => {
  try {
    const formKey = getFormKey(req);
    const parsed = await parseAnswersFromBody(req, formKey);
    if (parsed.status !== 200) {
      res.status(parsed.status).json(parsed.body);
      return;
    }

    const { data: existing, error: fetchError } = await supabase
      .from('registrations')
      .select('id, status')
      .eq('user_id', req.user!.id)
      .eq('form_key', formKey)
      .maybeSingle();

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: 'No registration found' });
      return;
    }

    const projected = projectRegistrationColumns(parsed.answers, req.user!);
    const updates = {
      answers: parsed.answers,
      form_version: parsed.formConfig.version,
      ...projected,
      email: req.user!.email ?? null,
      status: existing.status ?? 'pending',
    };

    const { data, error } = await supabase
      .from('registrations')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(toRegistrationResponse(data as RegistrationRow));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/registrations
 * Admin-only: list all registrations, newest first.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req.user!.id))) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { data, error } = await supabase
      .from('registrations')
      .select('*')
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
 * GET /api/registrations/:id
 * Owner or admin only.
 */
router.get(
  '/:id',
  validate({ params: RegistrationParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const row = await resolveOwnerOrAdmin('registrations', req.params.id, req, res);
      if (!row) return;
      res.json(toRegistrationResponse(row as RegistrationRow));
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/registrations/:id
 * Owner or admin only.
 */
router.put(
  '/:id',
  validate({ params: RegistrationParamsSchema }),
  async (req: Request<{ id: string }, {}, Record<string, unknown>>, res: Response) => {
    try {
      const owned = await resolveOwnerOrAdmin<RegistrationRow>('registrations', req.params.id, req, res);
      if (!owned) return;

      let updates: Record<string, unknown> = { ...req.body };

      if (
        Object.prototype.hasOwnProperty.call(req.body, 'answers') &&
        req.body.answers &&
        typeof req.body.answers === 'object' &&
        !Array.isArray(req.body.answers)
      ) {
        const formKey =
          typeof owned.form_key === 'string' && owned.form_key.trim()
            ? owned.form_key
            : 'registration';

        const parsed = await parseAnswersFromBody(
          req,
          formKey,
          req.body.answers as Record<string, unknown>,
        );
        if (parsed.status !== 200) {
          res.status(parsed.status).json(parsed.body);
          return;
        }

        updates = {
          answers: parsed.answers,
          form_version: parsed.formConfig.version,
          ...projectRegistrationColumns(parsed.answers, req.user!),
        };
      }

      delete updates.email;

      const { data, error } = await supabase
        .from('registrations')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json(toRegistrationResponse(data as RegistrationRow));
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/registrations/:id
 * Owner or admin only.
 */
router.delete(
  '/:id',
  validate({ params: RegistrationParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const owned = await resolveOwnerOrAdmin('registrations', req.params.id, req, res, 'user_id');
      if (!owned) return;

      const { error } = await supabase
        .from('registrations')
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
