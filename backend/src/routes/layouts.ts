import express from 'express';
import * as layoutsController from '../controllers/layoutsController';
import { validateRequest } from '../middleware/validation';
import { formLayoutSchema } from '../zod-schemas/formLayoutSchemas';

const layoutsRouter = express.Router();

layoutsRouter.route("/")
  .get(layoutsController.getAllLayouts)
  .post(validateRequest({body: formLayoutSchema}), layoutsController.createLayout);

layoutsRouter.route("/:id")
  .get(layoutsController.getLayoutById)
  .patch(layoutsController.updateLayout)
  .delete(layoutsController.deleteLayout);

export default layoutsRouter;