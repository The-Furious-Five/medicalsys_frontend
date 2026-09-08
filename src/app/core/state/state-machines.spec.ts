import { describe, expect, it } from 'vitest';
import {
  encounterTransitions,
  isEncounterEditable,
  prescriptionTransitions,
  studyOrderTransitions,
} from './state-machines';

/**
 * Estas transiciones se leyeron del código de ms-historial, no de la
 * documentación, que difería en el ciclo de la orden de estudio. Si el backend
 * cambia, esta prueba es la que debe fallar primero.
 */
describe('máquinas de estado del historial', () => {
  it('un encuentro en borrador se puede firmar o anular', () => {
    expect(encounterTransitions('DRAFT')).toEqual(['SIGNED', 'VOIDED']);
  });

  it('un encuentro firmado solo se puede anular, nunca editar', () => {
    expect(encounterTransitions('SIGNED')).toEqual(['VOIDED']);
    expect(isEncounterEditable('SIGNED')).toBe(false);
  });

  it('un encuentro anulado es terminal', () => {
    expect(encounterTransitions('VOIDED')).toEqual([]);
  });

  it('una orden solicitada puede saltar directa a muestra tomada', () => {
    // El backend lo permite aunque la guía describía un paso previo obligatorio.
    expect(studyOrderTransitions('REQUESTED')).toContain('SAMPLE_COLLECTED');
  });

  it('una orden informada es terminal', () => {
    expect(studyOrderTransitions('REPORTED')).toEqual([]);
  });

  it('una receta dispensada es terminal', () => {
    expect(prescriptionTransitions('DISPENSED')).toEqual([]);
  });
});
