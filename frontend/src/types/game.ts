export interface Game {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameInput {
  title: string;
  slug: string;
  description?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
