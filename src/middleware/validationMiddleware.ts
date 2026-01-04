import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed: any = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Apply parsed/coerced values (and defaults) back to the request
      if (parsed && typeof parsed === 'object') {
        if ('body' in parsed) req.body = parsed.body;
        // Express exposes `req.query` and `req.params` as read-only properties
        // in some setups; mutate their contents instead of reassigning.
        if ('query' in parsed) {
          const nextQuery = parsed.query ?? {};
          for (const key of Object.keys(req.query as any)) delete (req.query as any)[key];
          Object.assign(req.query as any, nextQuery);
        }
        if ('params' in parsed) {
          const nextParams = parsed.params ?? {};
          for (const key of Object.keys(req.params as any)) delete (req.params as any)[key];
          Object.assign(req.params as any, nextParams);
        }
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return next(error as any);
    }
  };