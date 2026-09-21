import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { applicantDecision, invitationErrorStatus, protectedInvitationFields, type InvitationFields } from '../utils/invitations';
import { getInvitationSettings, expireInvitations } from '../utils/emailSettings';
import { supabase } from '../config/supabase';
import {
  RegistrationParamsSchema,
} from '../types/registration';
import { validate } from '../middleware/validate';
import { isAdmin, resolveOwnerOrAdmin } from '../middleware/requireAdmin';
import { isRegistrationClosed, registrationClosedError, registrationClosureResponse } from '../utils/registrationClosure';
import {
  buildAnswersSchema,
  projectRegistrationColumns,
  type DynamicFormField,
} from '../utils/registrationForms';

const router = Router();

type RegistrationRow = InvitationFields & {
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
  is_active: boolean;
  closes_at: string | null;
  allow_late_waitlist?: boolean;
};

function getFormKey(req: Request): string {
  const value = req.query.form_key;
  return typeof value === 'string' && value.trim() ? value.trim() : 'registration';
}

async function getUserFormConfig(formKey: string): Promise<FormConfigRow | null> {
  const { data, error } = await supabase
    .from('form_configs')
    .select('*')
    .eq('key', formKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as FormConfigRow | null;
}

async function ensureRegistrationWritable(req: Request, res: Response, formKey: string, allowAdmin = false) {
  if (allowAdmin && await isAdmin(req.user!.id)) return true;
  const config = await getUserFormConfig(formKey);
  if (!config?.is_active) {
    res.status(404).json({ error: `Active form "${formKey}" not found` });
    return false;
  }
  if (isRegistrationClosed(config.closes_at)) {
    res.status(403).json(registrationClosedError(config.closes_at!));
    return false;
  }
  return true;
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
    ...applicantDecision(row),
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
  allowClosed = false,
  creating = false,
) {
  const formConfig = await getUserFormConfig(formKey);
  if (!formConfig || (!allowClosed && !formConfig.is_active)) {
    return {
      status: 404 as const,
      body: { error: `Active form "${formKey}" not found` },
    };
  }

  if (!allowClosed && isRegistrationClosed(formConfig.closes_at)) {
    if (creating && formConfig.allow_late_waitlist) {
      if (req.query.waitlist !== 'true') return {
        status: 412 as const,
        body: {
          ...registrationClosureResponse(formConfig),
          error: 'Registration has closed. Review the waitlist notice, then choose Apply on waitlist to submit.',
          code: 'WAITLIST_ACKNOWLEDGEMENT_REQUIRED',
        },
      };
    } else {
      return {
        status: 403 as const,
        body: { ...registrationClosedError(formConfig.closes_at!), allow_late_waitlist: formConfig.allow_late_waitlist === true },
      };
    }
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

router.get('/me/invitation-settings', async (_req, res) => {
  try { const expired_count = await expireInvitations(); res.json({ ...await getInvitationSettings(), expired_count, server_now: new Date().toISOString() }); }
  catch { res.status(500).json({ error: 'Could not load the invitation deadline.' }); }
});

router.put('/me/invitation-response', validate({ body: z.object({
  response: z.enum(['accepted', 'declined']),
}).strict() }), async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).length) {
      res.status(400).json({ error: 'Invitation responses apply to the main application only.' });
      return;
    }
    const { data, error } = await supabase.rpc('respond_to_registration_invitation', {
      p_user_id: req.user!.id, p_response: req.body.response,
    }).single();
    if (error) {
      const status = invitationErrorStatus(error.code);
      res.status(status).json({ error: status === 500 ? 'Could not save your response. Please try again.' : error.message });
      return;
    }
    res.json(toRegistrationResponse(data as RegistrationRow));
  } catch {
    res.status(500).json({ error: 'Could not save your response. Please try again.' });
  }
});

/** Issues a resume upload URL within the authenticated user's folder. */
router.post('/me/resume-upload-url', async (req: Request, res: Response) => {
  try {
    if (!await ensureRegistrationWritable(req, res, getFormKey(req))) return;
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
    if (!await ensureRegistrationWritable(req, res, formKey)) return;
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

    res.json(toRegistrationResponse(data as RegistrationRow));
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
 * GET /api/registrations/me/all
 * Returns the authenticated user's registrations across all form keys.
 */
router.get('/me/all', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('id, form_key, form_version, status, created_at, resume_path, released_status, decision_released_at, invitation_response, invitation_responded_at, invitation_expired_at')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((data ?? []).map(applicantDecision));
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
    const parsed = await parseAnswersFromBody(req, formKey, req.body, false, true);
    if (parsed.status !== 200) {
      res.status(parsed.status).json(parsed.body);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('registrations')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('form_key', formKey)
      .maybeSingle();

    if (existingError) {
      res.status(500).json({ error: 'Could not check your application. Please try again.' });
      return;
    }
    if (existing) {
      res.status(409).json({ error: 'Registration already exists for this user and form', code: 'REGISTRATION_EXISTS' });
      return;
    }

    const projected = projectRegistrationColumns(parsed.answers, req.user!);
    const payload = {
      user_id: req.user!.id,
      form_key: formKey,
      form_version: parsed.formConfig.version,
      answers: parsed.answers,
      status: 'pending',
      waitlist_acknowledged: req.query.waitlist === 'true',
      ...projected,
      email: req.user!.email ?? null,
    };

    const { data, error } = await supabase.rpc('create_registration_with_email', { p_registration: payload }).single();

    if (error) {
      if (error.code === 'PT403' || error.code === 'PT412') {
        const latest = await getUserFormConfig(formKey);
        res.status(error.code === 'PT412' ? 412 : 403).json({
          ...(latest ? registrationClosureResponse(latest) : {}),
          error: error.message,
          code: error.code === 'PT412' ? 'WAITLIST_ACKNOWLEDGEMENT_REQUIRED' : 'REGISTRATION_CLOSED',
        });
        return;
      }
      res.status(error.code === '23505' || error.code === 'PT409' ? 409 : error.code === 'PT404' ? 404 : 500)
        .json({ error: error.code === '23505' ? 'An application already exists for this account. Refresh your dashboard.' : error.message,
          code: error.code === '23505' ? 'REGISTRATION_EXISTS' : error.code === 'PT409' ? 'FORM_CHANGED' : undefined });
      return;
    }

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
      .select('id')
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

      const admin = await isAdmin(req.user!.id);
      const formKey = owned.form_key?.trim() || 'registration';
      let updates: Record<string, unknown> = { ...req.body };

      if (
        !admin || (
          Object.prototype.hasOwnProperty.call(req.body, 'answers') &&
          req.body.answers &&
          typeof req.body.answers === 'object' &&
          !Array.isArray(req.body.answers)
        )
      ) {
        // Student updates only project validated answers. Never accept ownership,
        // form_key, approval, or attendance columns directly from their request.
        const parsed = await parseAnswersFromBody(
          req,
          formKey,
          req.body.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers)
            ? req.body.answers as Record<string, unknown>
            : req.body,
          admin,
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
      for (const field of protectedInvitationFields) delete updates[field];

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
      const owned = await resolveOwnerOrAdmin<RegistrationRow>('registrations', req.params.id, req, res, 'user_id, form_key');
      if (!owned) return;
      if (!await ensureRegistrationWritable(req, res, owned.form_key?.trim() || 'registration', true)) return;

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
