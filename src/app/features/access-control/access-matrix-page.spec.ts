import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  name: code === 'PHYSICIAN' ? 'Médico' : 'Recepción',
  description: null,
  scope: 'ORGANIZATION',
  accessModel: 'MAC',
  system: true,
  active: true,
  permissions,
  assignableRoles: [],
});
const ROLES = [role('PHYSICIAN', [READ, SIGN]), role('RECEPTIONIST', [READ])];
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.inject(ApplicationRef).tick();
}
function signIn(permissions: readonly string[], roles = ['SECURITY_OFFICER']): void {
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
        roles,
        permissions,
      },
    }),
  );
}
const editorGrants = ['identity.role.read', 'identity.role.manage', READ.code, SIGN.code];

describe('espacio de roles y accesos', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AccessMatrixPage>;
  beforeAll(() => {
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
  afterEach(() => {
    sessionStorage.clear();
    http.verify();
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
  async function choose(root: HTMLElement, name: string) {
    Array.from(root.querySelectorAll<HTMLButtonElement>('.access-role-option'))
      .find((button) => button.querySelector('.access-role-name')?.textContent?.trim() === name)
      ?.click();
    await settle();
  }
  const toggle = (root: HTMLElement, label: string) =>
    root.querySelector<HTMLButtonElement>(`button[role="switch"][aria-label="${label}"]`);
  async function confirmSave(root: HTMLElement) {
    root.querySelector<HTMLButtonElement>('.access-pending .btn-primary')?.click();
    await settle();
    root
      .querySelector<HTMLButtonElement>(
        'dialog[aria-label="Revisar los cambios"] .dialog-foot .btn-primary',
      )
      ?.click();
    await settle();
  }
  it('presenta nombres y funciones comprensibles sin códigos ni modelos técnicos', async () => {
    signIn(editorGrants);
    const root = await open();
    expect(root.textContent).toContain('Médico');
    expect(root.textContent).toContain('Consultar atenciones');
    expect(root.textContent).not.toContain('clinical.');
    expect(root.textContent).not.toContain('PHYSICIAN');
    expect(root.textContent).not.toContain('MAC');
    expect(root.querySelector('table.matrix')).toBeNull();
  });
  it('guarda solo el rol editado y envía todos sus permisos al servidor', async () => {
    signIn(editorGrants);
    const root = await open();
    await choose(root, 'Recepción');
    toggle(root, 'Firmar atenciones para Recepción')?.click();
    await settle();
    expect(root.querySelector('.access-pending')?.textContent).toContain('1 cambio sin guardar');
    await confirmSave(root);
    const request = http.expectOne('/api/v1/identity/roles/RECEPTIONIST/permissions');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ permissions: [READ.code, SIGN.code] });
    request.flush(role('RECEPTIONIST', [READ, SIGN]));
    await settle();
    http.expectOne('/api/v1/identity/roles').flush([ROLES[0], role('RECEPTIONIST', [READ, SIGN])]);
    await settle();
    expect(root.querySelector('.access-pending')).toBeNull();
  });
  it('conserva los borradores al cambiar de rol y al fallar parte del guardado', async () => {
    signIn(editorGrants);
    const root = await open();
    toggle(root, 'Firmar atenciones para Médico')?.click();
    await settle();
    await choose(root, 'Recepción');
    toggle(root, 'Firmar atenciones para Recepción')?.click();
    await settle();
    expect(root.querySelector('.access-pending')?.textContent).toContain('2 cambios');
    await confirmSave(root);
    http.expectOne('/api/v1/identity/roles/PHYSICIAN/permissions').flush(
      {
        title: 'Conflicto',
        status: 409,
        detail: 'No puede cambiar el rol PHYSICIAN sin autorización.',
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
    expect(root.textContent).toContain('No se guardaron los accesos de Médico');
    expect(root.textContent).not.toContain('PHYSICIAN');
    await choose(root, 'Médico');
    expect(toggle(root, 'Firmar atenciones para Médico')?.getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(root.querySelector('.access-pending')?.textContent).toContain('1 cambio');
  });
  it('permite consultar sin ofrecer interruptores de edición', async () => {
    signIn(['identity.role.read']);
    const root = await open();
    expect(root.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(root.querySelectorAll('.access-read-state.is-allowed')).toHaveLength(2);
  });
  it('protege la edición del rol propio aunque la cuenta pueda administrar roles', async () => {
    signIn(editorGrants, ['PHYSICIAN']);
    const root = await open();
    expect(root.textContent).toContain('Estás usando este rol');
    const button = toggle(root, 'Firmar atenciones para Médico');
    expect(button?.disabled).toBe(true);
    button?.click();
    await settle();
    expect(root.querySelector('.access-pending')).toBeNull();
  });
  it('no concede funciones que quien actúa no puede otorgar', async () => {
    signIn(['identity.role.read', 'identity.role.manage', READ.code]);
    const root = await open();
    await choose(root, 'Recepción');
    expect(toggle(root, 'Firmar atenciones para Recepción')?.disabled).toBe(true);
  });
  it('la revisión distingue los accesos que se permiten y los que se retiran', async () => {
    signIn(editorGrants);
    const root = await open();
    toggle(root, 'Firmar atenciones para Médico')?.click();
    await settle();
    root.querySelector<HTMLButtonElement>('.access-pending .btn-primary')?.click();
    await settle();
    const dialog = root.querySelector('dialog[aria-label="Revisar los cambios"]');
    expect(dialog?.textContent).toContain('Retirar Firmar atenciones');
    expect(dialog?.textContent).toContain('Médico');
    expect(dialog?.textContent).not.toContain('clinical.');
    http.expectNone((request) => request.method === 'PUT');
  });
  it('pide una decisión antes de abandonar un borrador y permite continuar editando', async () => {
    signIn(editorGrants);
    const root = await open();
    toggle(root, 'Firmar atenciones para Médico')?.click();
    await settle();
    const leaving = fixture.componentInstance.requestLeave();
    await settle();
    root
      .querySelector<HTMLButtonElement>(
        'dialog[aria-label="Tienes cambios sin guardar"] .btn-secondary',
      )
      ?.click();
    await settle();
    expect(await leaving).toBe(false);
    expect(root.querySelector('.access-pending')).not.toBeNull();
  });
});
