import { Router, Request, Response, NextFunction } from "express";
import { createItem, getItemStatus } from "../services";
import { ItemNotFoundError } from "../errors";
import { validateBody, validateParams } from "../middleware";
import { createItemSchema, uuidParamSchema } from "../types/schemas";

const router = Router();

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

router.get(
  "/:id",
  validateParams(uuidParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await getItemStatus(req.params.id as string);
      if (!item) throw new ItemNotFoundError("Item not found");
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
