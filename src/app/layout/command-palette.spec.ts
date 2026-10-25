import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CommandPalette } from './command-palette';

describe('consultas del buscador global según los accesos', () => {
  let http: HttpTestingController;
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
  function signIn(permissions: readonly string[]): void {
    sessionStorage.setItem(
      'medicalsys.session',
      JSON.stringify({
        accessToken: 't',
        expiresAt: Date.now() + 3_600_000,
        user: { publicId: 'a', fullName: 'Usuario', roles: [], permissions },
      }),
    );
  }
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.inject(ApplicationRef).tick();
  }
  it('no consulta prestaciones al abrir el buscador sin acceso a ellas', async () => {
    signIn(['identity.role.read']);
    const fixture = TestBed.createComponent(CommandPalette);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();
    http.expectNone((request) => request.url.includes('/tenancy/prestaciones'));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Roles y accesos');
  });
  it('carga las prestaciones autorizadas solo cuando se abre el buscador', async () => {
    signIn(['tenancy.service_offering.read']);
    const fixture = TestBed.createComponent(CommandPalette);
    fixture.detectChanges();
    await settle();
    http.expectNone((request) => request.url.includes('/tenancy/prestaciones'));
    fixture.componentRef.setInput('open', true);
    await settle();
    const request = http.expectOne((entry) => entry.url.endsWith('/tenancy/prestaciones'));
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
    await settle();
  });
});
