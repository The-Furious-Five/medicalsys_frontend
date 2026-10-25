import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CatalogPermission } from './access-control.models';
import { accessAreas, accessFailure, permissionLabel } from './access-presentation';

const permission = (code: string): CatalogPermission => ({
  code,
  module: code.split('.')[0],
  description: 'Descripción del catálogo',
  classification: 'CONFIDENTIAL',
  sensitive: true,
});
const failure = (detail: string) =>
  new HttpErrorResponse({ status: 403, error: { status: 403, detail } });

describe('significado de los accesos para el usuario', () => {
  it('distingue emitir facturas, anularlas y firmar atenciones', () => {
    expect(permissionLabel(permission('billing.invoice.issue'))).toBe('Emitir facturas');
    expect(permissionLabel(permission('billing.invoice.void'))).toBe('Anular facturas');
    expect(permissionLabel(permission('clinical.encounter.sign'))).toBe('Firmar atenciones');
  });
  it('conserva cada función en un área e incluye cupones entre cobros y beneficios', () => {
    const catalog = [
      permission('clinical.record.read'),
      permission('marketing.coupon.redeem'),
      permission('marketing.campaign.launch'),
      permission('identity.role.assign'),
    ];
    const areas = accessAreas(catalog);
    expect(areas.flatMap((area) => area.permissions)).toHaveLength(catalog.length);
    expect(areas.find((area) => area.id === 'billing')?.permissions).toEqual([catalog[1]]);
    expect(areas.find((area) => area.id === 'marketing')?.permissions).toEqual([catalog[2]]);
  });
  it('explica las reglas con nombres y niveles comprensibles incluso si faltan roles', () => {
    const message = accessFailure(
      failure('El rol PHYSICIAN requiere RESTRICTED para clinical.narrative.read'),
      [],
      [permission('clinical.narrative.read')],
    );
    expect(message).toContain('Médico');
    expect(message).toContain('Restringido');
    expect(message).toContain('leer notas clínicas confidenciales');
    expect(message).not.toMatch(/PHYSICIAN|RESTRICTED|clinical\./);
  });
  it('convierte las instrucciones técnicas de delegación en un siguiente paso útil', () => {
    const message = accessFailure(
      failure(
        'Ninguno de sus roles tiene delegada la asignacion del rol NURSE; se configura con PUT /roles/{rol}/assignable-roles',
      ),
      [],
    );
    expect(message).toContain('responsable de accesos');
    expect(message).not.toMatch(/PUT|\/roles\/|NURSE/);
  });
});
