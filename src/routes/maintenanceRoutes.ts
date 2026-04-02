import { Router, Request, Response, NextFunction } from "express";
import { expireStaleReservations } from "../services";

const router = Router();

/**
 * @openapi
 * /v1/maintenance/expire-reservations:
 *   post:
 *     summary: Expire stale pending reservations and release inventory
 *     tags: [Maintenance]
 *     responses:
 *       200:
 *         description: Expired reservations processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     expired_count:
 *                       type: integer
 *                       example: 3
 */
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
