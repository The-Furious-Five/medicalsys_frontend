import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  function setup() {
    const auth = { login: vi.fn(), changeExpiredPassword: vi.fn() };
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return { fixture, element, auth };
  }

  it('la cuenta demo completa solo el correo: la contraseña no está en el código', () => {
    const { fixture, element } = setup();

    element.querySelector<HTMLButtonElement>('.access-demo-account')!.click();
    fixture.detectChanges();

    expect(element.querySelector<HTMLInputElement>('#login-email, input[name="email"]')!.value).toBe(
      'admin@medicalsys.demo',
    );
    expect(element.querySelector<HTMLInputElement>('#login-password')!.value).toBe('');
  });

  it('un envío vacío no llama al servicio y explica qué falta', () => {
    const { fixture, element, auth } = setup();

    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Ingresa tu correo y tu contraseña.');
  });
});
