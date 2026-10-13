import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { ACCOUNT_STATUS, options } from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { IdentityAccount } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { ACCOUNT_TONES } from './access-rules';
import { IssuedPassword, TemporaryPasswordDialog } from './temporary-password-dialog';
import { UserSheet } from './user-sheet';

/**
 * Gestión de usuarios (IAM-06): lista con búsqueda por nombre, correo o User ID, alta, edición,
 * baja, desbloqueo y reinicio de contraseña.
 *
 * ms-identidad sincroniza cada operación con Keycloak (IAM-04/IAM-05), así que la demo funciona de
 * punta a punta desde el navegador: nadie toca la base de datos ni la consola de Keycloak. Qué roles
 * tiene cada cuenta se decide en «Asignación de roles».
 */
@Component({
  selector: 'medsys-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    UserSheet,
    TemporaryPasswordDialog,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);

  protected readonly statuses = ACCOUNT_STATUS;
  protected readonly statusTones = ACCOUNT_TONES;
  protected readonly statusOptions = options(ACCOUNT_STATUS);

  protected readonly term = signal('');
  private readonly query = signal('');
  protected readonly status = signal<string | null>(null);
  protected readonly page = signal(0);
  private debounce = 0;

  protected readonly accounts = this.access.accountsResource(this.query, this.status, this.page);
  protected readonly roles = this.access.rolesResource();

  protected readonly canCreate = computed(() => can.createUsers(this.session.permissions()));
  protected readonly selected = signal<IdentityAccount | null>(null);
  protected readonly creating = signal(false);
  protected readonly issued = signal<IssuedPassword | null>(null);

  protected readonly countLabel = computed(() => {
    const total = this.accounts.value()?.totalElements ?? 0;
    return total === 1 ? '1 cuenta' : `${total} cuentas`;
  });

  /** La búsqueda espera a que se deje de escribir: cada tecla no es una consulta. */
  protected onTerm(value: string): void {
    this.term.set(value);
    window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.query.set(value);
      this.page.set(0);
    }, 300);
  }

  protected onStatus(value: string): void {
    this.status.set(value === '' ? null : value);
    this.page.set(0);
  }

  protected onRowKey(event: KeyboardEvent, account: IdentityAccount): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selected.set(account);
    }
  }

  protected closeSheet(): void {
    this.selected.set(null);
    this.creating.set(false);
  }
}
