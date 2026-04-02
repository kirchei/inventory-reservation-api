import { Router, Request, Response, NextFunction } from "express";
import { createReservation, confirmReservation, cancelReservation } from "../services";
import { validateBody, validateParams } from "../middleware";
import { createReservationSchema, uuidParamSchema } from "../types/schemas";

const router = Router();

router.post(
  "/",
  validateBody(createReservationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { item_id, customer_id, quantity } = req.body;
      const reservation = await createReservation(item_id, customer_id, quantity);
      res.status(201).json({ success: true, data: reservation });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/confirm",
  validateParams(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await confirmReservation(req.params.id as string);
      res.json({ success: true, data: reservation });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/cancel",
  validateParams(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await cancelReservation(req.params.id as string);
      res.json({ success: true, data: reservation });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
