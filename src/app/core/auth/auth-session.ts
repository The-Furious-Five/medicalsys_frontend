import { Injectable, computed, signal } from '@angular/core';
import { AuthenticatedUser, LoginResponse } from './authenticated-user';

const SESSION_KEY = 'medicalsys.session';
/** Se avisa dos minutos antes de que el token caduque. */
const WARN_BEFORE_MS = 120_000;

interface StoredSession {
  readonly accessToken: string;
  readonly expiresAt: number;
  readonly user: AuthenticatedUser;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    const session = JSON.parse(raw) as StoredSession;
    if (!session?.accessToken || !session.user) {
      return null;
    }
    // Un token ya vencido no es una sesión: es basura que provocaría un 401
    // en la primera petición.
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/**
 * Sesión del usuario. Guarda el token, la identidad y el vencimiento en
 * `sessionStorage` para que la recarga no expulse a nadie a mitad de una nota
 * clínica, y vigila la caducidad para avisar antes de que ocurra.
 */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly session = signal<StoredSession | null>(readStoredSession());
  private readonly warningDismissed = signal(false);
  private readonly now = signal(Date.now());

  readonly accessToken = computed(() => this.session()?.accessToken ?? null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly roles = computed<readonly string[]>(() => this.session()?.user.roles ?? []);
  readonly isAuthenticated = computed(() => this.session() !== null);

  /** Cierto en los dos minutos previos al vencimiento, salvo que ya se avisara. */
  readonly expiringSoon = computed(() => {
    const session = this.session();
    if (session === null || this.warningDismissed()) {
      return false;
    }
    const remaining = session.expiresAt - this.now();
    return remaining > 0 && remaining <= WARN_BEFORE_MS;
  });

  constructor() {
    // Un solo temporizador para toda la aplicación: comprueba el vencimiento y
    // cierra la sesión limpiamente en vez de dejar que falle la próxima
    // petición con un 401.
    setInterval(() => {
      this.now.set(Date.now());
      const session = this.session();
      if (session !== null && session.expiresAt <= Date.now()) {
        this.clear();
      }
    }, 15_000);

    // Una sesión cerrada en otra pestaña cierra también esta.
    window.addEventListener('storage', (event) => {
      if (event.key === SESSION_KEY && event.newValue === null) {
        this.session.set(null);
      }
    });
  }

  start(response: LoginResponse): void {
    const expiresAt = response.expiresAt
      ? new Date(response.expiresAt).getTime()
      : Date.now() + response.expiresInSeconds * 1000;
    const session: StoredSession = {
      accessToken: response.accessToken,
      expiresAt,
      user: response.user,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.warningDismissed.set(false);
    this.session.set(session);
  }

  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this.warningDismissed.set(false);
    this.session.set(null);
  }

  dismissExpiryWarning(): void {
    this.warningDismissed.set(true);
  }
}
