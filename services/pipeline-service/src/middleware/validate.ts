import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.errors.reduce((acc, curr) => {
        const path = curr.path.join('.');
        acc[path] = curr.message;
        return acc;
      }, {} as Record<string, string>);
      return res.status(400).json({ errors: fieldErrors });
    }
    next(error);
  }
};
