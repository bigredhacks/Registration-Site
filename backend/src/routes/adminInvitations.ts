import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { getInvitationSettings } from '../utils/emailSettings';
import { RegistrationClosesAtSchema, RegistrationTimezoneSchema } from '../utils/registrationClosure';
const router = Router();
router.get('/deadline', async (_req, res) => {
  try { res.json({ ...await getInvitationSettings(), server_now: new Date().toISOString() }); }
  catch { res.status(500).json({ error: 'Could not load the invitation deadline.' }); }
});
router.put('/deadline', validate({ body: z.object({ deadline: RegistrationClosesAtSchema, time_zone: RegistrationTimezoneSchema,
  expected_version: z.number().int().positive(),
}).strict() }), async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('update_invitation_deadline', { p_deadline: req.body.deadline,
      p_time_zone: req.body.time_zone, p_expected_version: req.body.expected_version, p_admin_id: req.user!.id });
    if (error) { res.status(error.code === 'PT409' ? 409 : error.code === 'PT400' ? 400 : error.code === 'PT403' ? 403 : 500)
      .json({ error: error.code.startsWith('PT') ? error.message : 'Could not save the invitation deadline.' }); return; }
    res.json({ ...data, server_now: new Date().toISOString() });
  } catch { res.status(500).json({ error: 'Could not confirm the deadline update. Reload to check it.' }); }
});
export default router;
