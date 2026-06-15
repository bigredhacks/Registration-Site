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

const router = Router();

/**
 * POST /api/registrations
 *
 * Creates a new registration.
 *
 * @body Full hackathon application payload
 * @returns 201 - The newly created registration object
 * @returns 400 - Validation error
 * @returns 500 - Database error
 */
router.post(
  '/',
  validate({ body: CreateRegistrationSchema }),
  async (req: Request<{}, {}, CreateRegistrationBody>, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('registrations')
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
 * GET /api/registrations
 *
 * Lists all registrations, ordered by creation date (newest first).
 *
 * @returns 200 - Array of registration objects
 * @returns 500 - Database error
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
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
 *
 * Retrieves a single registration by its ID.
 *
 * @param {int} id - Registration ID
 * @returns 200 - The registration object
 * @returns 400 - Invalid ID format
 * @returns 404 - Registration not found
 * @returns 500 - Database error
 */
router.get(
  '/:id',
  validate({ params: RegistrationParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
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
 * PUT /api/registrations/:id
 *
 * Updates an existing registration. At least one field must be provided.
 *
 * @param {string} id - Registration ID
 * @body Partial hackathon application payload
 * @returns 200 - The updated registration object
 * @returns 400 - Validation error (invalid ID, no fields, or empty strings)
 * @returns 404 - Registration not found
 * @returns 500 - Database error
 */
router.put(
  '/:id',
  validate({ params: RegistrationParamsSchema, body: UpdateRegistrationSchema }),
  async (req: Request<{ id: string }, {}, UpdateRegistrationBody>, res: Response) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('registrations')
        .update(req.body)
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

/**
 * DELETE /api/registrations/:id
 *
 * Deletes a registration by its ID.
 *
 * @param {int} id - Registration ID
 * @returns 204 - Successfully deleted (no content)
 * @returns 400 - Invalid ID format
 * @returns 500 - Database error
 */
router.delete(
  '/:id',
  validate({ params: RegistrationParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('registrations')
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
