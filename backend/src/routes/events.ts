import express from 'express';
import * as eventsController from '../controllers/eventsController';

const eventsRouter = express.Router();

eventsRouter.route("/")
  .get(eventsController.getAllEvents)
  .post(eventsController.createEvent);

eventsRouter.route("/:id")
  .get(eventsController.getEventById)
  .patch(eventsController.updateEvent)
  .delete(eventsController.deleteEvent);

export default eventsRouter;