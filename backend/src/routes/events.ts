import express from 'express';
import * as eventsController from '../controllers/formTypesController';

const eventsRouter = express.Router();

eventsRouter.route("/")
  .get(eventsController.getAllFormTypes)
  .post(eventsController.createFormType);

eventsRouter.route("/:id")
  .get(eventsController.getFormTypeById)
  .patch(eventsController.updateFormType)
  .delete(eventsController.deleteFormType);


export default eventsRouter;