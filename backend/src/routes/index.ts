import { Router } from 'express';
import registrationsRouter from './registrations';
import participantsRouter from './participants';
import teamsRouter from './teams';
import profileRouter from './profile';

const router = Router();

router.use('/registrations', registrationsRouter);
router.use('/participants', participantsRouter);
router.use('/teams', teamsRouter);
router.use('/profile', profileRouter);

export default router;
