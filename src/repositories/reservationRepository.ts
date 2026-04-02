import { supabase } from "../config/supabase";
import type { Reservation } from "../types";

export async function findReservationById(
  id: string
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return data as Reservation;
}
