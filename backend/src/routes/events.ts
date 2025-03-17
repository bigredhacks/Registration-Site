import express from 'express';
import * as eventsController from '../controllers/eventsController';
import { validateRequest } from '../middleware/validation';
import { eventSchema, eventPatchSchema } from '../zod-schemas/eventSchema';
import { mongoIdSchema } from '../zod-schemas/mongoIdSchema';

const eventsRouter = express.Router();

eventsRouter.route("/")
  .get(eventsController.getAllEvents)
  .post(validateRequest({body: eventSchema}), eventsController.createEvent);

eventsRouter.route("/:id")
  .get(validateRequest({ params: mongoIdSchema }), eventsController.getEventById)
  .patch(validateRequest({params: mongoIdSchema, body: eventPatchSchema}), eventsController.updateEvent)
  .delete(validateRequest({ params: mongoIdSchema }), eventsController.deleteEvent);

export default eventsRouter;