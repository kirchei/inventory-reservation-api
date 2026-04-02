import {
  reserveInventory,
  confirmReservation as repoConfirm,
  cancelReservation as repoCancel,
  expireReservations as repoExpire,
  findReservationById,
} from "../repositories";
import type { ReservationResponse, ExpireReservationsResponse } from "../types";

export class InsufficientInventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientInventoryError";
  }
}

export class ItemNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotFoundError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationNotFoundError";
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateTransitionError";
  }
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
    const message =
      err instanceof Error ? err.message : String(err);
    if (message.includes("ITEM_NOT_FOUND")) {
      throw new ItemNotFoundError("Item not found");
    }
    if (message.includes("INSUFFICIENT_INVENTORY")) {
      throw new InsufficientInventoryError("Insufficient inventory available");
    }
    throw err;
  }
}

export async function confirmReservation(
  reservationId: string
): Promise<ReservationResponse> {
  const existing = await findReservationById(reservationId);
  if (!existing) {
    throw new ReservationNotFoundError("Reservation not found");
  }

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
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ALREADY_CONFIRMED")) {
      const updated = await findReservationById(reservationId);
      return updated!;
    }
    if (
      message.includes("EXPIRED") ||
      message.includes("CANCELLED")
    ) {
      throw new InvalidStateTransitionError(message);
    }
    throw err;
  }

  const updated = await findReservationById(reservationId);
  return updated!;
}

export async function cancelReservation(
  reservationId: string
): Promise<ReservationResponse> {
  const existing = await findReservationById(reservationId);
  if (!existing) {
    throw new ReservationNotFoundError("Reservation not found");
  }

  if (existing.status === "CANCELLED" || existing.status === "EXPIRED") {
    return existing;
  }

  if (existing.status === "CONFIRMED") {
    throw new InvalidStateTransitionError(
      "Reservation was already confirmed"
    );
  }

  try {
    await repoCancel(reservationId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ALREADY_CANCELLED") || message.includes("EXPIRED")) {
      const updated = await findReservationById(reservationId);
      return updated!;
    }
    if (message.includes("CONFIRMED")) {
      throw new InvalidStateTransitionError(
        "Reservation was already confirmed"
      );
    }
    throw err;
  }

  const updated = await findReservationById(reservationId);
  return updated!;
}

export async function expireStaleReservations(): Promise<ExpireReservationsResponse> {
  const expiredCount = await repoExpire();
  return { expired_count: expiredCount };
}
