import { Request, Response, NextFunction } from "express";
import {
  InsufficientInventoryError,
  ItemNotFoundError,
  ReservationNotFoundError,
  InvalidStateTransitionError,
} from "../errors";
import type { ApiErrorResponse } from "../types";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const response: ApiErrorResponse = {
    success: false,
    error: err.message,
  };

  if (err instanceof ItemNotFoundError || err instanceof ReservationNotFoundError) {
    res.status(404).json(response);
    return;
  }

  if (err instanceof InsufficientInventoryError) {
    res.status(409).json(response);
    return;
  }

  if (err instanceof InvalidStateTransitionError) {
    res.status(409).json(response);
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
}
