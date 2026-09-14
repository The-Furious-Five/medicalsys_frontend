export interface ApiError {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  correlationId: string;
  path: string;
  details?: Readonly<Record<string, unknown>>;
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ApiError>;

  return (
    typeof candidate.timestamp === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.correlationId === 'string' &&
    typeof candidate.path === 'string'
  );
}
