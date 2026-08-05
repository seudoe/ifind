export interface DateRange {
  start: string;
  end?: string | null;
  isCurrent: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}
