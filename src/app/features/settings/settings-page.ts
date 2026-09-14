import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { ROLE, label } from '../../core/labels/labels';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { Icon, IconName } from '../../core/ui/icon';
import { PageHeader } from '../../shared/page-header';

interface ModeOption {
  readonly value: ThemeMode;
  readonly label: string;
  readonly description: string;
  readonly icon: IconName;
}

/**
 * Configuración personal.
 *
 * Jerarquía: son ajustes de quien usa la aplicación, no del centro —lo del
 * centro vive en Organización—. Cada ajuste se presenta como una fila con su
 * nombre, lo que hace y el control a la derecha, para poder recorrerlos de
 * arriba abajo sin leer párrafos.
 */
@Component({
  selector: 'medsys-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Icon],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly theme = inject(ThemeService);
  private readonly session = inject(AuthSession);

  protected readonly mode = this.theme.mode;
  protected readonly user = this.session.user;
  protected readonly roleSummary = computed(() =>
    this.session
      .roles()
      .map((role) => label(ROLE, role))
      .join(' · '),
  );

  protected readonly modes: readonly ModeOption[] = [
    {
      value: 'light',
      label: 'Claro',
      description: 'El modo predeterminado. Es el que ve cualquiera al entrar.',
      icon: 'sun',
    },
    {
      value: 'dark',
      label: 'Oscuro',
      description: 'Para salas con poca luz o turnos de noche.',
      icon: 'moon',
    },
  ];

  protected select(mode: ThemeMode): void {
    this.theme.set(mode);
  }
}
