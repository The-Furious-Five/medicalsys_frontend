import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-url';
import { AuthSession } from './auth-session';
import { LoginResponse, MfaChallenge, MfaEnrollment } from './authenticated-user';

/**
 * Inicio de sesión en dos pasos (IAM-03, IAM-07): usuario y contraseña devuelven un desafío; la
 * sesión recién se abre con el código de la aplicación autenticadora.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  /** Primer paso. Una contraseña válida no abre sesión: responde qué falta del segundo factor. */
  login(username: string, password: string): Promise<MfaChallenge> {
    return firstValueFrom(
      this.http.post<MfaChallenge>(`${this.baseUrl}/identity/auth/login`, { username, password }),
    );
  }

  /** Primer ingreso: QR y secreto para registrar la aplicación autenticadora. */
  startMfaEnrollment(mfaToken: string): Promise<MfaEnrollment> {
    return firstValueFrom(
      this.http.post<MfaEnrollment>(`${this.baseUrl}/identity/auth/mfa/enrollment`, { mfaToken }),
    );
  }

  /** Primer ingreso: el primer código confirma el registro y abre la sesión. */
  async activateMfa(mfaToken: string, code: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.baseUrl}/identity/auth/mfa/activate`, {
        mfaToken,
        code,
      }),
    );
    this.session.start(response);
  }

  async verifyMfa(mfaToken: string, code: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.baseUrl}/identity/auth/mfa/verify`, { mfaToken, code }),
    );
    this.session.start(response);
  }

  /**
   * Primer ingreso con contraseña temporal o contraseña vencida (IAM-05): el login responde 403
   * PASSWORD_CHANGE_REQUIRED y no hay sesión, así que la cuenta va por su usuario. Keycloak valida
   * la actual y aplica la política a la nueva.
   */
  async changeExpiredPassword(
    username: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/identity/auth/change-password`, {
        username,
        currentPassword,
        newPassword,
      }),
    );
  }

  /**
   * Cierra la sesión local siempre. Avisar al servidor es deseable pero no
   * puede ser condición: si esa llamada falla, dejar al usuario dentro sería
   * peor que no haber avisado.
   */
  logout(redirectTo: string | null = '/acceso'): void {
    if (this.session.isAuthenticated()) {
      this.http.post(`${this.baseUrl}/identity/auth/logout`, {}).subscribe({
        error: () => undefined,
      });
    }
    this.session.clear();
    if (redirectTo !== null) {
      void this.router.navigate([redirectTo]);
    }
  }
}
