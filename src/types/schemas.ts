import { z } from "zod";

export const createItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  initial_quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than 0"),
});

export const createReservationSchema = z.object({
  item_id: z.string().uuid("Invalid item ID format"),
  customer_id: z.string().min(1, "Customer ID is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than 0"),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});
