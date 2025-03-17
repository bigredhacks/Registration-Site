import express from 'express';
import * as layoutsController from '../controllers/layoutsController';
import { validateRequest } from '../middleware/validation';
import { formLayoutSchema, formLayoutPatchSchema } from '../zod-schemas/formLayoutSchemas';
import { mongoIdSchema } from '../zod-schemas/mongoIdSchema';

const layoutsRouter = express.Router();

layoutsRouter.route("/")
  .get(layoutsController.getAllLayouts)
  .post(validateRequest({body: formLayoutSchema}), layoutsController.createLayout);

layoutsRouter.route("/:id")
  .get(validateRequest({ params: mongoIdSchema }), layoutsController.getLayoutById)
  .patch(validateRequest({ params: mongoIdSchema, body: formLayoutPatchSchema }), layoutsController.updateLayout)
  .delete(validateRequest({ params: mongoIdSchema }), layoutsController.deleteLayout);

export default layoutsRouter;