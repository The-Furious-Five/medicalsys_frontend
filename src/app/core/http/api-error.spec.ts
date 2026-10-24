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

describe('describeFailure con los errores de ms-identidad (IAM-03)', () => {
  const problem = (status: number, detail: string, code?: string) =>
    new HttpErrorResponse({
      status,
      error: { status, title: 'x', detail, correlationId: 'c-1', ...(code ? { code } : {}) },
    });

  it('lee el code del ProblemDetail', () => {
    expect(describeFailure(problem(400, 'Muy corta', 'PASSWORD_POLICY_VIOLATION')).code).toBe(
      'PASSWORD_POLICY_VIOLATION',
    );
    expect(describeFailure(problem(409, 'Conflicto')).code).toBe('HTTP_409');
  });

  it('explica la cuenta bloqueada sin pedir que se reintente ni que se llame a soporte', () => {
    const detail = describeFailure(
      problem(423, 'La cuenta esta bloqueada por intentos fallidos', 'ACCOUNT_LOCKED'),
    );
    expect(detail.title).toBe('Cuenta bloqueada');
    expect(detail.retryable).toBe(false);
    expect(detail.message).not.toContain('soporte');
  });

  it('no confunde el cambio de contraseña requerido con falta de permiso', () => {
    const detail = describeFailure(
      problem(403, 'Debes cambiar tu contrasena', 'PASSWORD_CHANGE_REQUIRED'),
    );
    expect(detail.title).toBe('Cambio de contraseña requerido');
    expect(detail.message).not.toContain('Tu rol');
  });
});
