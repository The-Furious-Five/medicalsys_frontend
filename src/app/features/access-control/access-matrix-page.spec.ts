import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogPermission, Role } from './access-control.models';
import { AccessMatrixPage } from './access-matrix-page';

const READ: CatalogPermission = {
  code: 'clinical.encounter.read',
  module: 'CLINICAL',
  description: 'Consultar encuentros',
  sensitive: true,
  classification: 'CONFIDENTIAL',
};
const SIGN: CatalogPermission = {
  code: 'clinical.encounter.sign',
  module: 'CLINICAL',
  description: 'Firmar encuentros',
  sensitive: true,
  classification: 'CONFIDENTIAL',
};

const role = (code: string, permissions: readonly CatalogPermission[]): Role => ({
  code,
  name: code,
  description: null,
  scope: 'ORGANIZATION',
  system: true,
  active: true,
  permissions,
  assignableRoles: [],
});

/** ms-identidad devuelve los roles ordenados por código. */
const ROLES = [role('PHYSICIAN', [READ, SIGN]), role('RECEPTIONIST', [READ])];

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.inject(ApplicationRef).tick();
}

function signIn(permissions: readonly string[]): void {
  sessionStorage.setItem(
    'medicalsys.session',
    JSON.stringify({
      accessToken: 't',
      expiresAt: Date.now() + 3_600_000,
      user: {
        publicId: 'officer',
        fullName: 'Oficial de seguridad',
        email: 'oficial@medicalsys.bo',
        organizationPublicId: 'o',
        status: 'ACTIVE',
        language: 'es',
        roles: ['SECURITY_OFFICER'],
        permissions,
      },
    }),
  );
}

describe('AccessMatrixPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AccessMatrixPage>;

  beforeAll(() => {
    // jsdom no implementa <dialog>: a la matriz solo le importa que abrir y cerrar no fallen.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function open(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(AccessMatrixPage);
    fixture.detectChanges();
    await settle();
    http.expectOne('/api/v1/identity/roles').flush(ROLES);
    http.expectOne('/api/v1/identity/permissions').flush([READ, SIGN]);
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  const cell = (root: HTMLElement, code: string, roleCode: string) =>
    root.querySelector<HTMLInputElement>(`input[aria-label="${code} para ${roleCode}"]`);

  async function confirmSave(root: HTMLElement): Promise<void> {
    root.querySelector<HTMLButtonElement>('.matrix-pending .btn-primary')?.click();
    await settle();
    root.querySelector<HTMLButtonElement>('medsys-confirm-dialog .btn-primary')?.click();
    await settle();
  }

  it('guarda solo el rol que cambió, con su conjunto completo de permisos', async () => {
    signIn(['identity.role.read', 'identity.role.manage', READ.code, SIGN.code]);
    const root = await open();

    cell(root, SIGN.code, 'RECEPTIONIST')?.click();
    await settle();
    expect(root.querySelector('.matrix-pending')?.textContent).toContain('1 cambio');

    await confirmSave(root);
    const put = http.expectOne('/api/v1/identity/roles/RECEPTIONIST/permissions');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ permissions: [READ.code, SIGN.code] });
    put.flush(role('RECEPTIONIST', [READ, SIGN]));
    await settle();

    http.expectOne('/api/v1/identity/roles').flush([ROLES[0], role('RECEPTIONIST', [READ, SIGN])]);
    await settle();
    http.verify();
    expect(root.querySelector('.matrix-pending')).toBeNull();
  });

  it('si el servicio rechaza un rol, ese conserva lo marcado y los demás quedan guardados', async () => {
    signIn(['identity.role.read', 'identity.role.manage', READ.code, SIGN.code]);
    const root = await open();

    cell(root, SIGN.code, 'PHYSICIAN')?.click();
    cell(root, SIGN.code, 'RECEPTIONIST')?.click();
    await settle();
    await confirmSave(root);

    http.expectOne('/api/v1/identity/roles/PHYSICIAN/permissions').flush(
      {
        title: 'Conflicto',
        status: 409,
        detail:
          'La operacion dejaria a la plataforma sin ninguna cuenta activa que pueda administrar roles',
        service: 'ms-identidad',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();
    http
      .expectOne('/api/v1/identity/roles/RECEPTIONIST/permissions')
      .flush(role('RECEPTIONIST', [READ, SIGN]));
    await settle();
    http.expectOne('/api/v1/identity/roles').flush([ROLES[0], role('RECEPTIONIST', [READ, SIGN])]);
    await settle();

    // El motivo es el del servicio: la regla de continuidad de RBAC-02.
    expect(root.textContent).toContain('No se guardaron los permisos de PHYSICIAN');
    expect(root.textContent).toContain('sin ninguna cuenta activa que pueda administrar roles');
    // El cambio rechazado sigue marcado y pendiente; el aceptado ya es lo guardado.
    expect(cell(root, SIGN.code, 'PHYSICIAN')?.checked).toBe(false);
    expect(root.querySelector('.matrix-pending')?.textContent).toContain('1 cambio');
    expect(cell(root, SIGN.code, 'RECEPTIONIST')?.checked).toBe(true);
  });

  it('sin identity.role.manage la matriz se lee pero no se edita', async () => {
    signIn(['identity.role.read']);
    const root = await open();

    expect(root.querySelectorAll('table input[type="checkbox"]')).toHaveLength(0);
    // PHYSICIAN tiene los dos permisos y RECEPTIONIST uno: tres marcas en la tabla.
    expect(root.querySelectorAll('td.matrix-cell medsys-icon')).toHaveLength(3);
  });
});
