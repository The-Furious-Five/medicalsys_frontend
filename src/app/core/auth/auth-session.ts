import { Injectable, computed, signal } from '@angular/core';

const ACCESS_TOKEN_KEY = 'medicalsys.accessToken';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly token = signal<string | null>(sessionStorage.getItem(ACCESS_TOKEN_KEY));

  readonly accessToken = this.token.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  setAccessToken(accessToken: string): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    this.token.set(accessToken);
  }

  clear(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    this.token.set(null);
  }
}
