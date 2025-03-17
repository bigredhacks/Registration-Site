
import { Request, Response, NextFunction } from "express"
import { ZodError } from "zod";
import RequestValidator from "../interfaces/RequestValidators";

export const validateRequest = (validator: RequestValidator) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (validator.params) {
        req.params = await validator.params.parseAsync(req.params);
      }
      if (validator.query) {
        req.query = await validator.query.parseAsync(req.query);
      }
      if (validator.body) {
        req.body = await validator.body.parseAsync(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422); // Unprocessable Entity
      }
      next(err)
    }
  }
}