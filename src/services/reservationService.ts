import {
  reserveInventory,
  confirmReservation as repoConfirm,
  cancelReservation as repoCancel,
  expireReservations as repoExpire,
  findReservationById,
} from "../repositories";
import {
  InsufficientInventoryError,
  ItemNotFoundError,
  ReservationNotFoundError,
  InvalidStateTransitionError,
} from "../errors";
import type { ReservationResponse, ExpireReservationsResponse } from "../types";

function mapRpcError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith("ITEM_NOT_FOUND:")) {
    throw new ItemNotFoundError("Item not found");
  }
  if (message.startsWith("INSUFFICIENT_INVENTORY:")) {
    throw new InsufficientInventoryError("Insufficient inventory available");
  }
  if (message.startsWith("RESERVATION_NOT_FOUND:")) {
    throw new ReservationNotFoundError("Reservation not found");
  }
  if (message.startsWith("EXPIRED:")) {
    throw new InvalidStateTransitionError("Reservation has expired");
  }
  if (message.startsWith("CANCELLED:")) {
    throw new InvalidStateTransitionError("Reservation was cancelled");
  }
  if (message.startsWith("CONFIRMED:")) {
    throw new InvalidStateTransitionError("Reservation was already confirmed");
  }
  throw err;
}

export async function createReservation(
  itemId: string,
  customerId: string,
  quantity: number
): Promise<ReservationResponse> {
  try {
    const reservation = await reserveInventory(itemId, customerId, quantity);
    return {
      id: reservation.id,
      item_id: reservation.item_id,
      customer_id: reservation.customer_id,
      quantity: reservation.quantity,
      status: reservation.status,
      created_at: reservation.created_at,
      expires_at: reservation.expires_at,
      updated_at: reservation.updated_at,
    };
  } catch (err: unknown) {
    return mapRpcError(err);
  }
}

export async function confirmReservation(
  reservationId: string
): Promise<ReservationResponse> {
  const existing = await findReservationById(reservationId);
  if (!existing) {
    throw new ReservationNotFoundError("Reservation not found");
  }

  // Idempotent: already confirmed — return current state
  if (existing.status === "CONFIRMED") {
    return existing;
  }

  if (existing.status === "CANCELLED") {
    throw new InvalidStateTransitionError("Reservation was cancelled");
  }

  if (existing.status === "EXPIRED") {
    throw new InvalidStateTransitionError("Reservation has expired");
  }

  try {
    await repoConfirm(reservationId);
  } catch (err: unknown) {
    return mapRpcError(err);
  }

  const updated = await findReservationById(reservationId);
  if (!updated) throw new ReservationNotFoundError("Reservation not found");

  // The RPC auto-expires PENDING reservations past their TTL instead of
  // confirming them. It returns normally (not an exception) so the expire
  // commits durably. We detect it here and reject the confirmation.
  if (updated.status === "EXPIRED") {
    throw new InvalidStateTransitionError("Reservation has expired");
  }

  return updated;
}

export async function cancelReservation(
  reservationId: string
): Promise<ReservationResponse> {
  const existing = await findReservationById(reservationId);
  if (!existing) {
    throw new ReservationNotFoundError("Reservation not found");
  }

  // Idempotent: already cancelled or expired (hold already released)
  if (existing.status === "CANCELLED" || existing.status === "EXPIRED") {
    return existing;
  }

  if (existing.status === "CONFIRMED") {
    throw new InvalidStateTransitionError("Reservation was already confirmed");
  }

  try {
    await repoCancel(reservationId);
  } catch (err: unknown) {
    return mapRpcError(err);
  }

  const updated = await findReservationById(reservationId);
  if (!updated) throw new ReservationNotFoundError("Reservation not found");
  return updated;
}

export async function expireStaleReservations(): Promise<ExpireReservationsResponse> {
  const expiredCount = await repoExpire();
  return { expired_count: expiredCount };
}
