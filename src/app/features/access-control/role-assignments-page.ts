import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { todayIso } from '../../core/format/format';
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
import { ACCOUNT_TONES, ASSIGNMENT_STATE, assignmentState, assignmentTone } from './access-rules';
import { AccountRolesSheet } from './account-roles-sheet';

/**
 * Asignación de roles a cuentas.
 *
 * Lista las cuentas que quien consulta puede ver —las de su organización, o
 * todas si opera la plataforma— con sus roles y la vigencia de cada uno. Los
 * roles se asignan y se revocan en la hoja de cada cuenta. Crear, editar o
 * desactivar cuentas es otra pantalla (IAM-06): aquí solo se decide qué
 * función cumple cada una.
 */
@Component({
  selector: 'medsys-role-assignments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    AccountRolesSheet,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './role-assignments-page.html',
})
export class RoleAssignmentsPage {
  private readonly access = inject(AccessControlService);

  protected readonly statuses = ACCOUNT_STATUS;
  protected readonly statusTones = ACCOUNT_TONES;
  protected readonly statusOptions = options(ACCOUNT_STATUS);
  protected readonly assignmentStates = ASSIGNMENT_STATE;
  protected readonly assignmentTones = assignmentTone;

  protected readonly term = signal('');
  private readonly query = signal('');
  protected readonly status = signal<string | null>(null);
  protected readonly page = signal(0);
  private debounce = 0;

  protected readonly accounts = this.access.accountsResource(this.query, this.status, this.page);
  protected readonly roles = this.access.rolesResource();
  protected readonly selected = signal<IdentityAccount | null>(null);

  private readonly roleNames = computed(
    () => new Map((this.roles.value() ?? []).map((role) => [role.code, role.name])),
  );
  private readonly today = todayIso();

  protected readonly countLabel = computed(() => {
    const total = this.accounts.value()?.totalElements ?? 0;
    return total === 1 ? '1 cuenta' : `${total} cuentas`;
  });

  /** Los roles de la cuenta, con por qué cada uno da o no da acceso hoy. */
  protected assignments(account: IdentityAccount) {
    return account.roles.map((assignment) => ({
      id: assignment.id,
      name: this.roleNames().get(assignment.role) ?? assignment.role,
      state: assignmentState(assignment, this.today),
    }));
  }

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
}
