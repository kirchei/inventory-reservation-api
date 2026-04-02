import { Router, Request, Response, NextFunction } from "express";
import { expireStaleReservations } from "../services";

const router = Router();

router.post(
  "/expire-reservations",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await expireStaleReservations();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
