export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

export interface Reservation {
  readonly id: string;
  readonly item_id: string;
  readonly customer_id: string;
  readonly quantity: number;
  readonly status: ReservationStatus;
  readonly created_at: string;
  readonly expires_at: string;
  readonly updated_at: string;
}

export interface CreateReservationRequest {
  readonly item_id: string;
  readonly customer_id: string;
  readonly quantity: number;
}

export interface ReservationResponse {
  readonly id: string;
  readonly item_id: string;
  readonly customer_id: string;
  readonly quantity: number;
  readonly status: ReservationStatus;
  readonly created_at: string;
  readonly expires_at: string;
  readonly updated_at: string;
}

export interface ExpireReservationsResponse {
  readonly expired_count: number;
}
