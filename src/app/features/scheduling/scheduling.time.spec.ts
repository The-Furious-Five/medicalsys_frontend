import { describe, expect, it } from 'vitest';
import {
  addDays,
  clinicDate,
  clinicInstant,
  clinicTime,
  dayRange,
  durationLabel,
  durationMinutes,
  minutesOfDay,
  startOfWeek,
  weekDays,
  weekdayOf,
} from './scheduling.time';

/**
 * La agenda se equivoca de día con una facilidad peligrosa: el navegador razona
 * en la zona del equipo y ms-agenda en la del centro. Estas pruebas fijan que
 * todo lo que se muestra y todo lo que se envía está en hora de La Paz.
 */
describe('tiempo de la agenda', () => {
  it('un instante se lee en la hora del centro, no en la del equipo', () => {
    expect(clinicTime('2026-09-01T13:30:00Z')).toBe('09:30');
    expect(clinicDate('2026-09-01T02:00:00Z')).toBe('2026-08-31');
  });

  it('una hora local del centro viaja con su desfase', () => {
    expect(clinicInstant('2026-09-01', '09:00')).toBe('2026-09-01T09:00:00-04:00');
  });

  it('el rango del día cubre de medianoche a medianoche', () => {
    expect(dayRange('2026-09-01')).toEqual({
      from: '2026-09-01T00:00:00-04:00',
      to: '2026-09-02T00:00:00-04:00',
    });
  });

  it('la posición vertical de una cita son sus minutos desde medianoche', () => {
    expect(minutesOfDay('2026-09-01T09:30:00-04:00')).toBe(9 * 60 + 30);
  });

  it('la semana empieza en lunes, como en Bolivia', () => {
    // 2026-09-01 es martes.
    expect(weekdayOf('2026-09-01')).toBe(2);
    expect(startOfWeek('2026-09-01')).toBe('2026-08-31');
    expect(weekDays('2026-09-01')).toHaveLength(7);
    expect(weekDays('2026-09-01')[6]).toBe('2026-09-06');
  });

  it('sumar días cruza el cambio de mes', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('la duración se lee en horas y minutos, no en minutos sueltos', () => {
    expect(durationMinutes('2026-09-01T09:00:00-04:00', '2026-09-01T10:30:00-04:00')).toBe(90);
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(90)).toBe('1 h 30 min');
  });
});
