import { createItem as repoCreateItem, findItemById } from "../repositories";
import type { ItemResponse } from "../types";

function toItemResponse(item: {
  id: string;
  name: string;
  total_quantity: number;
  reserved_quantity: number;
  confirmed_quantity: number;
  created_at: string;
  updated_at: string;
}): ItemResponse {
  return {
    id: item.id,
    name: item.name,
    total_quantity: item.total_quantity,
    available_quantity:
      item.total_quantity - item.reserved_quantity - item.confirmed_quantity,
    reserved_quantity: item.reserved_quantity,
    confirmed_quantity: item.confirmed_quantity,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export async function createItem(
  name: string,
  initialQuantity: number
): Promise<ItemResponse> {
  const item = await repoCreateItem(name, initialQuantity);
  return toItemResponse(item);
}

export async function getItemStatus(id: string): Promise<ItemResponse | null> {
  const item = await findItemById(id);
  if (!item) return null;
  return toItemResponse(item);
}
