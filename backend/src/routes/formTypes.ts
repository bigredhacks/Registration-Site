import express from 'express';
import * as formTypesController from '../controllers/formTypesController';

const formTypesRouter = express.Router();

formTypesRouter.route("/")

formTypesRouter.route("/:id")

export default formTypesRouter;