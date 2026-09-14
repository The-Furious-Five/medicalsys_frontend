import { describe, expect, it } from 'vitest';
import { isApiError } from './api-error';

describe('isApiError', () => {
  it('accepts the common MedicalSys error contract', () => {
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

  it('rejects incomplete errors', () => {
    expect(isApiError({ status: 500, message: 'Unexpected error' })).toBe(false);
  });
});
