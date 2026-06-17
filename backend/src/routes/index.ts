import { Router } from 'express';
import registrationsRouter from './registrations';
import participantsRouter from './participants';
import teamsRouter from './teams';
import profileRouter from './profile';
import adminRouter from './admin';
import formConfigsRouter from './formConfigs';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use('/registrations', requireAuth, registrationsRouter);
router.use('/participants', requireAuth, participantsRouter);
router.use('/teams', requireAuth, teamsRouter);
router.use('/profile', profileRouter);
router.use('/form-configs', requireAuth, formConfigsRouter);
router.use('/admin', requireAuth, adminRouter);

export default router;
