import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { toCatalogsError } from './catalogs-error';

describe('toCatalogsError', () => {
  it('keeps the common MedicalSys error body from the gateway', () => {
    const body = {
      timestamp: '2026-09-05T00:00:00Z',
      status: 503,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      correlationId: 'corr-123',
      path: '/api/v1/catalogs/specialties',
    };

    expect(
      toCatalogsError(
        new HttpErrorResponse({
          error: body,
          status: 503,
          statusText: 'Service Unavailable',
          url: '/api/v1/catalogs/specialties',
        }),
      ),
    ).toEqual(body);
  });

  it('maps a network failure when the gateway is unreachable', () => {
    const mapped = toCatalogsError(
      new HttpErrorResponse({
        error: new ProgressEvent('error'),
        status: 0,
        statusText: 'Unknown Error',
        url: '/api/v1/catalogs/specialties',
        headers: new HttpHeaders({ 'X-Correlation-Id': 'corr-local' }),
      }),
    );

    expect(mapped.status).toBe(0);
    expect(mapped.code).toBe('NETWORK_ERROR');
    expect(mapped.correlationId).toBe('corr-local');
    expect(mapped.message).toContain('API Gateway');
  });
});
