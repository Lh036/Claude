import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../services/business/business.service.js";
import { NotFoundError } from "../services/scan/scanService.js";
import { logger } from "../logging/logger.js";

/** Wraps an async Express handler so a rejected promise reaches the error middleware instead of crashing the process. */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: "validation_error", message: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: "not_found", message: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error("api_unhandled_error", message, undefined, { path: req.path, method: req.method });
  // Never leak internals (stack traces, config, API keys) to the client.
  res.status(500).json({ error: "internal_error", message: "An unexpected error occurred" });
}
