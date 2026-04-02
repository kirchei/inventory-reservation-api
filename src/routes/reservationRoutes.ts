import { Router, Request, Response, NextFunction } from "express";
import {
  createReservation,
  confirmReservation,
  cancelReservation,
  expireStaleReservations,
} from "../services";
import { validateBody, validateParams } from "../middleware";
import { createReservationSchema, uuidParamSchema } from "../types/schemas";

const router = Router();

/**
 * @openapi
 * /v1/reservations:
 *   post:
 *     summary: Create a reservation (temporary hold)
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [item_id, customer_id, quantity]
 *             properties:
 *               item_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               customer_id:
 *                 type: string
 *                 example: "customer-123"
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 3
 *     responses:
 *       201:
 *         description: Reservation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReservationResponse'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Insufficient inventory
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /v1/reservations/{id}/confirm:
 *   post:
 *     summary: Confirm a reservation (permanently deduct inventory)
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation UUID
 *     responses:
 *       200:
 *         description: Reservation confirmed (idempotent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReservationResponse'
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Invalid state transition (expired or cancelled)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /v1/reservations/{id}/cancel:
 *   post:
 *     summary: Cancel a reservation (release held inventory)
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation UUID
 *     responses:
 *       200:
 *         description: Reservation cancelled (idempotent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReservationResponse'
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Invalid state transition (already confirmed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
