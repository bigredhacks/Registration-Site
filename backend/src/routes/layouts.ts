import express from 'express';
import * as layoutsController from '../controllers/layoutsController';

const layoutsRouter = express.Router();

layoutsRouter.route("/")
  .get(layoutsController.getAllLayouts)
  .post(layoutsController.createLayout);

layoutsRouter.route("/:id")
  .get(layoutsController.getLayoutById)
  .patch(layoutsController.updateLayout)
  .delete(layoutsController.deleteLayout);

export default layoutsRouter;