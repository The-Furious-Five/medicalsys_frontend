import { describe, expect, it } from 'vitest';
import { CatalogPermission, Role } from './access-control.models';
import {
  changesBetween,
  gridOf,
  matrixColumn,
  matrixTable,
  rolesTable,
  toCsv,
} from './access-matrix';

const permission = (code: string, module: string, sensitive = false): CatalogPermission => ({
  code,
  module,
  description: `Descripción de ${code}`,
  sensitive,
  classification: 'INTERNAL',
});

const SIGN = permission('clinical.encounter.sign', 'CLINICAL', true);
const READ = permission('clinical.encounter.read', 'CLINICAL', true);
const ISSUE = permission('billing.invoice.issue', 'BILLING');

const role = (
  code: string,
  permissions: readonly CatalogPermission[],
  extra: Partial<Role> = {},
): Role => ({
  code,
  name: code,
  description: null,
  scope: 'ORGANIZATION',
  system: false,
  active: true,
  permissions,
  assignableRoles: [],
  ...extra,
});

describe('matriz de accesos', () => {
  it('ubica cada acción en la columna del Anexo B de PO-02', () => {
    expect(matrixColumn('clinical.encounter.read')).toBe('R');
    expect(matrixColumn('billing.invoice.issue')).toBe('C');
    expect(matrixColumn('clinical.encounter.void')).toBe('D');
    expect(matrixColumn('clinical.encounter.sign')).toBe('Aprobar');
    expect(matrixColumn('audit.log.export')).toBe('Ejecutar');
    // Una acción nueva sin columna se ve en la matriz en vez de esconderse.
    expect(matrixColumn('clinical.encounter.archive')).toBe('—');
  });

  it('calcula lo que el borrador agrega y quita, solo de los roles que cambian', () => {
    const saved = gridOf([role('PHYSICIAN', [READ, SIGN]), role('RECEPTIONIST', [READ])]);
    const draft = new Map(saved).set('PHYSICIAN', new Set([READ.code, ISSUE.code]));

    expect(changesBetween(saved, draft)).toEqual([
      { role: 'PHYSICIAN', added: [ISSUE.code], removed: [SIGN.code] },
    ]);
  });

  it('exporta una fila por permiso, agrupada por módulo, con una X por rol', () => {
    const table = matrixTable(
      [
        role('RECEPTIONIST', [READ]),
        role('PHYSICIAN', [READ, SIGN]),
        role('AUDITOR', [], { active: false }),
      ],
      [SIGN, ISSUE, READ],
    );

    // Los roles de sistema van en el orden de la operación; un rol inactivo se marca.
    expect(table[0]).toEqual([
      'Módulo',
      'Permiso',
      'Descripción',
      'Sensible',
      'Columna',
      'PHYSICIAN',
      'RECEPTIONIST',
      'AUDITOR (inactivo)',
    ]);
    expect(table.slice(1).map((row) => [row[1], ...row.slice(5)])).toEqual([
      ['clinical.encounter.read', 'X', 'X', ''],
      ['clinical.encounter.sign', 'X', '', ''],
      ['billing.invoice.issue', '', '', ''],
    ]);
  });

  it('el CSV no deja que un nombre de rol se ejecute como fórmula', () => {
    const csv = toCsv(rolesTable([role('AUDITOR', [], { name: '=HYPERLINK("http://x","clic")' })]));

    // El apóstrofo convierte la fórmula en texto, y las comillas se duplican (RFC 4180).
    expect(csv.split('\r\n')[1]).toBe(
      `AUDITOR,"'=HYPERLINK(""http://x"",""clic"")",Organización,Activo,No,0,`,
    );
  });
});
