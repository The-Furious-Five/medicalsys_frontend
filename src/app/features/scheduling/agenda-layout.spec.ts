import { describe, expect, it } from 'vitest';
import { assignLanes, hourWindow } from './agenda-layout';

/**
 * La rejilla es lo que hace legible la agenda: si dos bloques se tapan, una
 * cita desaparece de la vista aunque exista en la base. Estas pruebas fijan ese
 * comportamiento.
 */
describe('geometría del tablero', () => {
  it('una cita sola ocupa toda la columna', () => {
    expect(assignLanes([{ startMinute: 540, endMinute: 570 }])).toEqual([{ lane: 0, lanes: 1 }]);
  });

  it('dos citas seguidas no se consideran solapadas', () => {
    const lanes = assignLanes([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 600, endMinute: 660 },
    ]);
    expect(lanes).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it('dos citas solapadas se reparten el ancho en dos carriles', () => {
    const lanes = assignLanes([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 570, endMinute: 630 },
    ]);
    expect(lanes.map((item) => item.lane)).toEqual([0, 1]);
    expect(lanes.every((item) => item.lanes === 2)).toBe(true);
  });

  it('un grupo solapado no estrecha a las citas que vienen después', () => {
    const lanes = assignLanes([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 570, endMinute: 630 },
      { startMinute: 700, endMinute: 730 },
    ]);
    expect(lanes[2]).toEqual({ lane: 0, lanes: 1 });
  });

  it('la jornada por defecto va de 07:00 a 20:00', () => {
    expect(hourWindow([])).toEqual({ from: 7, to: 20 });
  });

  it('una cita fuera de la jornada amplía la ventana, nunca la recorta', () => {
    const window = hourWindow([{ startMinute: 6 * 60 + 30, endMinute: 21 * 60 + 15 }]);
    expect(window).toEqual({ from: 6, to: 22 });
  });
});
