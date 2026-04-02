import { supabase } from "../config/supabase";
import type { Item } from "../types";

export async function createItem(
  name: string,
  totalQuantity: number
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .insert({ name, total_quantity: totalQuantity })
    .select()
    .single();

  if (error) throw error;
  return data as Item;
}

export async function findItemById(id: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return data as Item;
}
