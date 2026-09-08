import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-url';
import { AuthSession } from './auth-session';
import { LoginResponse } from './authenticated-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.baseUrl}/identity/auth/login`, { email, password }),
    );
    this.session.start(response);
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
