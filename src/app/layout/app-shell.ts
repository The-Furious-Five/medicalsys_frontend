import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { AuthSession } from '../core/auth/auth-session';
import { initials } from '../core/format/format';
import { ROLE, label } from '../core/labels/labels';
import { Icon } from '../core/ui/icon';
import { ToastHost } from '../shared/toast-host';
import { Tooltip } from '../shared/tooltip';
import { CommandPalette } from './command-palette';
import { visibleNav } from './nav';

/**
 * Armazón de la aplicación: barra lateral fija a la izquierda, cabecera de
 * 56 px y contenido con desplazamiento propio.
 *
 * La cabecera queda para el trabajo —buscar y saber si el sistema responde— y
 * todo lo que es «tu cuenta» vive al pie de la barra lateral, que es donde se
 * espera y donde no compite con la tarea que se tiene delante.
 */
@Component({
  selector: 'medsys-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, CommandPalette, ToastHost, Tooltip],
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly session = inject(AuthSession);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.session.user;
  protected readonly roles = this.session.roles;
  protected readonly expiringSoon = this.session.expiringSoon;
  protected readonly groups = computed(() => visibleNav(this.roles()));
  protected readonly avatar = computed(() => initials(this.user()?.fullName));
  protected readonly roleSummary = computed(() =>
    this.roles()
      .map((role) => label(ROLE, role))
      .join(' · '),
  );

  protected readonly collapsed = signal(localStorage.getItem('medicalsys.sidebar') === 'collapsed');
  protected readonly mobileOpen = signal(false);
  protected readonly paletteOpen = signal(false);
  protected readonly accountMenuOpen = signal(false);

  constructor() {
    effect(() => {
      localStorage.setItem('medicalsys.sidebar', this.collapsed() ? 'collapsed' : 'expanded');
    });

    // Cerrar la navegación móvil al cambiar de vista: dejar el menú abierto
    // después de elegir destino obliga a un gesto de más.
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.mobileOpen.set(false);
      this.accountMenuOpen.set(false);
      this.mostrarElementoActivo();
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.paletteOpen.set(true);
      }
      if (event.key === 'Escape') {
        this.accountMenuOpen.set(false);
      }
    });

    document.addEventListener('click', (event) => {
      if (this.accountMenuOpen() && !(event.target as Element)?.closest('.account')) {
        this.accountMenuOpen.set(false);
      }
    });
  }

  protected logout(): void {
    this.auth.logout();
  }

  protected dismissExpiry(): void {
    this.session.dismissExpiryWarning();
  }

  /**
   * Trae a la vista el elemento del menú que corresponde a la ruta actual.
   *
   * El menú tiene veintidós entradas y en un portátil no caben todas: al entrar
   * en Catálogos o en Configuración, la entrada activa quedaba fuera de la parte
   * visible y el menú aparentaba no haber cambiado. `block: 'nearest'` mueve lo
   * mínimo, así que si ya se ve no se toca nada.
   */
  private mostrarElementoActivo(): void {
    // Dos cuadros de espera, no un microtask: `routerLinkActive` marca el enlace
    // durante el repintado que sigue a la navegación, así que en el microtask
    // siguiente todavía no hay ningún `.is-active` que buscar.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector('.sidebar-nav a.is-active')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }),
    );
  }
}
