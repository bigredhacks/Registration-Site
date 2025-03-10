import express from 'express';
import * as formTypesController from '../controllers/formTypesController';

const formTypesRouter = express.Router();

formTypesRouter.route("/")
  .get(formTypesController.getAllFormTypes)
  .post(formTypesController.createFormType);

formTypesRouter.route("/:id")
  .get(formTypesController.getFormTypeById)
  .patch(formTypesController.updateFormType)
  .delete(formTypesController.deleteFormType);


export default formTypesRouter;