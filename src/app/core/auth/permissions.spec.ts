import { describe, expect, it } from 'vitest';
import { can } from './permissions';

/**
 * La tabla se derivó de los `@RequiresRole` reales de cada controlador. Estas
 * pruebas fijan los casos que se comprobaron contra el backend en ejecución.
 */
describe('permisos por rol', () => {
  it('administración no escribe historia clínica', () => {
    // Comprobado contra el backend: devuelve 403 en narrativa, signos vitales,
    // diagnósticos, recetas y órdenes de estudio.
    expect(can.writeNarrative(['ADMINISTRATOR'])).toBe(false);
    expect(can.signEncounter(['ADMINISTRATOR'])).toBe(false);
  });

  it('el profesional de salud escribe y firma', () => {
    expect(can.writeNarrative(['PHYSICIAN'])).toBe(true);
    expect(can.signEncounter(['PHYSICIAN'])).toBe(true);
  });

  it('recepción no ve el consumo del plan', () => {
    expect(can.viewUsage(['RECEPTIONIST'])).toBe(false);
  });

  it('recepción sí puede facturar y registrar pacientes', () => {
    expect(can.issueInvoice(['RECEPTIONIST'])).toBe(true);
    expect(can.registerPatient(['RECEPTIONIST'])).toBe(true);
  });
});
