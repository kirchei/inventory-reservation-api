import { z } from "zod";

const MAX_INT32 = 2_147_483_647;

export const createItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  initial_quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than 0")
    .max(MAX_INT32, "Quantity exceeds maximum allowed value"),
});

export const createReservationSchema = z.object({
  item_id: z.string().uuid("Invalid item ID format"),
  customer_id: z.string().min(1, "Customer ID is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than 0")
    .max(MAX_INT32, "Quantity exceeds maximum allowed value"),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
