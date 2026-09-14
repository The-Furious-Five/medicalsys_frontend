import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, isApiError } from '../../core/http/api-error';

export function toCatalogsError(error: HttpErrorResponse): ApiError {
  if (isApiError(error.error)) {
    return error.error;
  }

  return {
    timestamp: new Date().toISOString(),
    status: error.status || 0,
    code: error.status === 0 ? 'NETWORK_ERROR' : 'CATALOGS_REQUEST_FAILED',
    message:
      error.status === 0
        ? 'No fue posible conectar con el API Gateway. Verifica que el backend esté levantado.'
        : 'El servicio de catálogos no pudo completar la consulta. Intenta nuevamente.',
    correlationId: error.headers.get('X-Correlation-Id') ?? '',
    path: error.url ?? '/api/v1/catalogs',
  };
}
