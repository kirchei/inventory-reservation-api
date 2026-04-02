import { supabase } from "../config/supabase";
import type { Reservation } from "../types";

interface ReserveResult {
  readonly reservation_id: string;
  readonly item_id: string;
  readonly customer_id: string;
  readonly quantity: number;
  readonly status: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly updated_at: string;
}

interface ConfirmCancelResult {
  readonly reservation_id: string;
  readonly status: string;
  readonly quantity: number;
  readonly item_id: string;
  readonly updated_at: string;
}

interface ExpireResult {
  readonly expired_count: number;
}

export async function reserveInventory(
  itemId: string,
  customerId: string,
  quantity: number
): Promise<Reservation> {
  const { data, error } = await supabase.rpc("reserve_inventory", {
    p_item_id: itemId,
    p_customer_id: customerId,
    p_quantity: quantity,
  });

  if (error) throw new Error(error.message);
  const result = data as ReserveResult;
  return {
    id: result.reservation_id,
    item_id: result.item_id,
    customer_id: result.customer_id,
    quantity: result.quantity,
    status: result.status,
    created_at: result.created_at,
    expires_at: result.expires_at,
    updated_at: result.updated_at,
  } as Reservation;
}

export async function confirmReservation(
  reservationId: string
): Promise<ConfirmCancelResult> {
  const { data, error } = await supabase.rpc("confirm_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) throw new Error(error.message);
  return data as ConfirmCancelResult;
}

export async function cancelReservation(
  reservationId: string
): Promise<ConfirmCancelResult> {
  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) throw new Error(error.message);
  return data as ConfirmCancelResult;
}

export async function expireReservations(): Promise<number> {
  const { data, error } = await supabase.rpc("expire_stale_reservations");

  if (error) throw new Error(error.message);
  const result = data as ExpireResult | null;
  return result?.expired_count ?? 0;
}
