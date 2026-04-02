export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
