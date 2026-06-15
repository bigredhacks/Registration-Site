import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

/**
 * Express middleware factory that validates request data against Zod schemas.
 *
 * @param schema.body - Schema to validate req.body
 * @param schema.params - Schema to validate req.params
 */
export function validate(schema: { body?: ZodType; params?: ZodType }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatErrors(result.error));
      } else {
        req.params = result.data as Record<string, string>;
      }
    }

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatErrors(result.error));
      } else {
        req.body = result.data;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    next();
  };
}

function formatErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}
