import { describe, expect, it } from 'vitest';
import { visibleNav } from '../../layout/nav';
import { can } from './permissions';

const labels = (granted: readonly string[]) =>
  visibleNav(granted).flatMap((group) => group.items.map((item) => item.label));

/**
 * La interfaz sigue a los permisos del token, no al nombre del rol: es lo que
 * hace que un cambio en la matriz de accesos se vea en el próximo inicio de
 * sesión sin tocar el frontend.
 */
describe('permisos de la interfaz', () => {
  it('un rol creado desde la API ve exactamente lo que sus permisos alcanzan', () => {
    // Un AUDITOR con los permisos de la bitácora: ningún rol de sistema se llama
    // así, y aun así ve su pantalla y nada más.
    expect(labels(['audit.log.read', 'audit.log.export'])).toEqual(['Inicio', 'Auditoría']);
  });

  it('quitar un permiso en la matriz oculta su pantalla aunque el rol sea de sistema', () => {
    const reception = ['patients.patient.read', 'patients.patient.create', 'clinical.record.read'];
    expect(labels(reception)).toContain('Pacientes');

    const withoutPatients = reception.filter((code) => code !== 'patients.patient.read');
    expect(labels(withoutPatients)).not.toContain('Pacientes');
    expect(labels(withoutPatients)).toContain('Expedientes');
  });

  it('cada acción exige el permiso de su endpoint, no el de su pantalla', () => {
    // Ver pacientes no da para registrarlos: ms-pacientes rechaza el POST sin
    // patients.patient.create, que es lo que le faltaba al profesional de salud.
    expect(can.registerPatient(['patients.patient.read'])).toBe(false);
    expect(can.registerPatient(['patients.patient.create'])).toBe(true);
  });

  it('separa emision y anulacion, consulta y exportacion de auditoria', () => {
    const cashier1 = ['billing.invoice.read', 'billing.invoice.issue'];
    const cashier2 = ['billing.invoice.read', 'billing.invoice.void'];
    expect(can.issueInvoice(cashier1)).toBe(true);
    expect(can.correctInvoice(cashier1)).toBe(false);
    expect(can.issueInvoice(cashier2)).toBe(false);
    expect(can.correctInvoice(cashier2)).toBe(true);
    expect(can.exportAudit(['audit.log.read'])).toBe(false);
    expect(can.exportAudit(['audit.log.export'])).toBe(true);
    expect(can.verifyAudit(['audit.log.read'])).toBe(false);
    expect(can.viewAdvertisements(['marketing.advertisement.view'])).toBe(true);
    expect(can.viewPatients(['patients.self_access.read'])).toBe(false);
    expect(can.viewOwnAccess(['patients.self_access.read'])).toBe(true);
  });

  it('cada rol ISO-01 ve solo sus módulos', () => {
    // Enfermería: signos vitales y expediente, sin facturación ni sistema.
    const nurse = ['clinical.record.read', 'clinical.encounter.read', 'patients.patient.read'];
    expect(labels(nurse)).toEqual(['Inicio', 'Pacientes', 'Expedientes', 'Encuentros']);
    // OSI: administra accesos y cuentas (IAM-06) y lee la bitácora, sin ningún módulo clínico.
    const osi = ['identity.role.read', 'identity.user.read', 'audit.log.read'];
    expect(labels(osi)).toEqual([
      'Inicio',
      'Auditoría',
      'Usuarios',
      'Roles y accesos',
      'Accesos del personal',
    ]);
  });
});
