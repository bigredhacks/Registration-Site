import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  CreateRegistrationBody,
  UpdateRegistrationBody,
  CreateRegistrationSchema,
  UpdateRegistrationSchema,
  RegistrationParamsSchema,
} from '../types/registration';
import { validate } from '../middleware/validate';
import { isAdmin, resolveOwnerOrAdmin } from '../middleware/requireAdmin';
import { sendRegistrationConfirmation } from '../utils/email';

const router = Router();

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
    if (!resumePath.startsWith(`${req.user!.id}/`)) {
      res.status(400).json({ error: 'resume_path must be inside the caller\'s folder' });
      return;
    }

    const { data, error } = await supabase
      .from('registrations')
      .update({ resume_path: resumePath })
      .eq('user_id', req.user!.id)
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
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('resume_path')
      .eq('user_id', req.user!.id)
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
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', req.user!.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'No registration found' });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/registrations
 * Creates a registration owned by the authenticated user.
 * Returns 409 if the user already has one.
 */
router.post(
  '/',
  validate({ body: CreateRegistrationSchema }),
  async (req: Request<{}, {}, CreateRegistrationBody>, res: Response) => {
    try {
      const { data: existing } = await supabase
        .from('registrations')
        .select('id')
        .eq('user_id', req.user!.id)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Registration already exists for this user' });
        return;
      }

      // email is bound to the authenticated account, not the request body, so
      // a user can't direct the confirmation email elsewhere.
      const payload = { ...req.body, user_id: req.user!.id, email: req.user!.email };

      const { data, error } = await supabase
        .from('registrations')
        .insert(payload)
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      // Fire-and-forget; never fail submission on email transport error.
      sendRegistrationConfirmation({
        to: data.email,
        firstName: data.first_name,
      }).catch((e) => console.error('[email] confirmation failed:', e));

      res.status(201).json(data);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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
      res.json(row);
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
  validate({ params: RegistrationParamsSchema, body: UpdateRegistrationSchema }),
  async (req: Request<{ id: string }, {}, UpdateRegistrationBody>, res: Response) => {
    try {
      const owned = await resolveOwnerOrAdmin('registrations', req.params.id, req, res, 'user_id');
      if (!owned) return;

      const { data, error } = await supabase
        .from('registrations')
        .update(req.body)
        .eq('id', req.params.id)
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
