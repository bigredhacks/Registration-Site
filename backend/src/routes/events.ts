import express from 'express';
import * as eventsController from '../controllers/eventsController';
import { validateRequest } from '../middleware/validation';
import { eventSchema, eventPatchSchema } from '../zod-schemas/eventSchema';

const eventsRouter = express.Router();

eventsRouter.route("/")
  .get(eventsController.getAllEvents)
  .post(validateRequest({body: eventSchema}), eventsController.createEvent);

eventsRouter.route("/:id")
  .get(eventsController.getEventById)
  .patch(validateRequest({body: eventPatchSchema}), eventsController.updateEvent)
  .delete(eventsController.deleteEvent);

export default eventsRouter;