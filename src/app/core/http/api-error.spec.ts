import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { describeFailure, isApiError } from './api-error';

const apiError = (status: number, code: string, message: string) =>
  new HttpErrorResponse({
    status,
    error: {
      timestamp: '2026-09-02T02:26:41Z',
      status,
      code,
      message,
      correlationId: '147c87d8-e5f4-4d24-a760-4974f8897a0c',
      path: '/api/v1/encuentros',
    },
  });

describe('isApiError', () => {
  it('acepta el contrato de error común de MedicalSys', () => {
    expect(
      isApiError({
        timestamp: '2026-08-28T18:03:51Z',
        status: 409,
        code: 'APPOINTMENT_OVERLAP',
        message: 'El profesional ya tiene una cita en esa franja',
        correlationId: '147c87d8-e5f4-4d24-a760-4974f8897a0c',
        path: '/api/v1/scheduling/appointments',
      }),
    ).toBe(true);
  });

  it('rechaza errores incompletos', () => {
    expect(isApiError({ status: 500, message: 'Unexpected error' })).toBe(false);
  });
});

describe('describeFailure', () => {
  it('distingue la falta de permiso y no ofrece reintentar', () => {
    const detail = describeFailure(apiError(403, 'FORBIDDEN', 'El rol no permite la operación'));
    expect(detail.title).toBe('Sin permiso para esta sección');
    expect(detail.retryable).toBe(false);
  });

  it('trata el conflicto de negocio como algo que reintentar no arregla', () => {
    const detail = describeFailure(
      apiError(422, 'ENCOUNTER_NOT_EDITABLE', 'El encuentro esta en estado SIGNED'),
    );
    expect(detail.title).toBe('La operación entra en conflicto');
    expect(detail.retryable).toBe(false);
  });

  it('conserva el identificador de la operación para soporte', () => {
    const detail = describeFailure(apiError(500, 'INTERNAL_ERROR', 'Fallo inesperado'));
    expect(detail.correlationId).toBe('147c87d8-e5f4-4d24-a760-4974f8897a0c');
    expect(detail.retryable).toBe(true);
  });

  it('lee el motivo de un ProblemDetail, que es como responde ms-identidad', () => {
    const detail = describeFailure(
      new HttpErrorResponse({
        status: 409,
        error: {
          type: 'about:blank',
          title: 'Conflicto',
          status: 409,
          detail: 'Segregacion de funciones: el rol BILLING_CLERK es incompatible con PHYSICIAN',
          service: 'ms-identidad',
          correlationId: '147c87d8-e5f4-4d24-a760-4974f8897a0c',
        },
      }),
    );
    // El motivo del servicio, no el «conflicto» genérico: dice qué par choca.
    expect(detail.message).toContain('es incompatible con PHYSICIAN');
    expect(detail.correlationId).toBe('147c87d8-e5f4-4d24-a760-4974f8897a0c');
  });

  it('explica la caída de red sin exponer detalles técnicos', () => {
    const detail = describeFailure(new HttpErrorResponse({ status: 0 }));
    expect(detail.title).toBe('El servicio no responde');
    expect(detail.message).toContain('conexión');
  });
});
