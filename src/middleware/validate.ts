import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof Error && "issues" in err) {
        const issues = (err as { issues: Array<{ message: string }> }).issues;
        const message = issues.map((e) => e.message).join(", ");
        res.status(400).json({ success: false, error: message });
        return;
      }
      next(err);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      if (err instanceof Error && "issues" in err) {
        const issues = (err as { issues: Array<{ message: string }> }).issues;
        const message = issues.map((e) => e.message).join(", ");
        res.status(400).json({ success: false, error: message });
        return;
      }
      next(err);
    }
  };
}
