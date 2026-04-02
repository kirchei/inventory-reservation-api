export interface Item {
  readonly id: string;
  readonly name: string;
  readonly total_quantity: number;
  readonly reserved_quantity: number;
  readonly confirmed_quantity: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ItemResponse {
  readonly id: string;
  readonly name: string;
  readonly total_quantity: number;
  readonly available_quantity: number;
  readonly reserved_quantity: number;
  readonly confirmed_quantity: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateItemRequest {
  readonly name: string;
  readonly initial_quantity: number;
}
