import { Router, Request, Response, NextFunction } from "express";
import { createItem, getItemStatus } from "../services";
import { validateBody, validateParams } from "../middleware";
import { createItemSchema, uuidParamSchema } from "../types/schemas";

const router = Router();

/**
 * @openapi
 * /v1/items:
 *   post:
 *     summary: Create a new inventory item
 *     tags: [Items]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, initial_quantity]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "White T-Shirt"
 *               initial_quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *     responses:
 *       201:
 *         description: Item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ItemResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  validateBody(createItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, initial_quantity } = req.body;
      const item = await createItem(name, initial_quantity);
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /v1/items/{id}:
 *   get:
 *     summary: Get item status with computed quantities
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Item UUID
 *     responses:
 *       200:
 *         description: Item status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ItemResponse'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:id",
  validateParams(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await getItemStatus(req.params.id as string);
      if (!item) {
        res.status(404).json({ success: false, error: "Item not found" });
        return;
      }
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
