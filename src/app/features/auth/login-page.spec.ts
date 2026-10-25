import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  function setup() {
    const auth = {
      login: vi.fn(),
      changeExpiredPassword: vi.fn(),
      startMfaEnrollment: vi.fn(),
      activateMfa: vi.fn(),
      verifyMfa: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return { fixture, element, auth };
  }

  function type(element: HTMLElement, selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit(
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    element: HTMLElement,
  ) {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('se ve como en producción: sin cuentas de ejemplo ni aviso de entorno de pruebas', () => {
    const { element } = setup();

    expect(element.querySelector('.access-demo, .access-demo-account')).toBeNull();
    expect(element.textContent).not.toMatch(/demostración|medicalsys\.demo/i);
    expect(element.querySelector('#login-username')).not.toBeNull();
    expect(element.querySelector('input[type="email"]')).toBeNull();
  });

  it('un envío vacío no llama al servicio y explica qué falta', async () => {
    const { fixture, element, auth } = setup();

    await submit(fixture, element);

    expect(auth.login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Ingresa tu usuario y tu contraseña.');
  });

  it('primer ingreso: tras la contraseña muestra el QR y el código lo activa', async () => {
    const { fixture, element, auth } = setup();
    auth.login.mockResolvedValue({
      status: 'MFA_ENROLLMENT_REQUIRED',
      mfaToken: 'desafio',
      expiresInSeconds: 300,
      username: 'ana.perez.r',
    });
    auth.startMfaEnrollment.mockResolvedValue({
      issuer: 'MedicalSys',
      accountName: 'ana.perez.r',
      secret: 'ABCD EFGH IJKL MNOP',
      otpauthUri: 'otpauth://totp/MedicalSys:ana.perez.r?secret=ABCDEFGHIJKLMNOP',
      qrImage: 'data:image/svg+xml;base64,PHN2Zy8+',
    });
    auth.activateMfa.mockResolvedValue(undefined);

    type(element, '#login-username', 'Ana.Perez.R');
    type(element, '#login-password', 'Una clave larga 9!');
    await submit(fixture, element);

    expect(auth.login).toHaveBeenCalledWith('Ana.Perez.R', 'Una clave larga 9!');
    expect(auth.startMfaEnrollment).toHaveBeenCalledWith('desafio');
    expect(element.querySelector<HTMLImageElement>('.access-qr img')!.src).toContain(
      'data:image/svg+xml',
    );
    expect(element.textContent).toContain('ABCD EFGH IJKL MNOP');

    type(element, '#mfa-code', '12 34 56');
    await submit(fixture, element);

    expect(auth.activateMfa).toHaveBeenCalledWith('desafio', '123456');
  });

  it('ingreso habitual: pide el código de la aplicación, no el QR', async () => {
    const { fixture, element, auth } = setup();
    auth.login.mockResolvedValue({
      status: 'MFA_REQUIRED',
      mfaToken: 'desafio',
      expiresInSeconds: 300,
      username: 'ana.perez.r',
    });
    auth.verifyMfa.mockResolvedValue(undefined);

    type(element, '#login-username', 'ana.perez.r');
    type(element, '#login-password', 'Una clave larga 9!');
    await submit(fixture, element);

    expect(element.querySelector('.access-qr')).toBeNull();
    expect(auth.startMfaEnrollment).not.toHaveBeenCalled();
    type(element, '#mfa-code', '654321');
    await submit(fixture, element);

    expect(auth.verifyMfa).toHaveBeenCalledWith('desafio', '654321');
  });

  it('un código incorrecto se explica y permite reintentar', async () => {
    const { fixture, element, auth } = setup();
    auth.login.mockResolvedValue({
      status: 'MFA_REQUIRED',
      mfaToken: 'desafio',
      expiresInSeconds: 300,
      username: 'ana.perez.r',
    });
    auth.verifyMfa.mockRejectedValue(
      new HttpErrorResponse({
        status: 401,
        error: {
          status: 401,
          detail: 'El codigo no es valido o ya se uso.',
          code: 'MFA_INVALID_CODE',
        },
      }),
    );

    type(element, '#login-username', 'ana.perez.r');
    type(element, '#login-password', 'Una clave larga 9!');
    await submit(fixture, element);
    type(element, '#mfa-code', '000000');
    await submit(fixture, element);

    expect(element.textContent).toContain('El codigo no es valido o ya se uso.');
    expect(element.querySelector('#mfa-code')).not.toBeNull();
  });

  it('contraseña temporal: pide la nueva antes del segundo factor', async () => {
    const { fixture, element, auth } = setup();
    auth.login.mockRejectedValue(
      new HttpErrorResponse({
        status: 403,
        error: {
          status: 403,
          detail: 'Debes cambiar tu contrasena.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        },
      }),
    );

    type(element, '#login-username', 'ana.perez.r');
    type(element, '#login-password', 'Temporal-1234-Abcd');
    await submit(fixture, element);

    expect(element.querySelector('#change-new')).not.toBeNull();
    expect(element.textContent).toContain('ana.perez.r');
  });
});
