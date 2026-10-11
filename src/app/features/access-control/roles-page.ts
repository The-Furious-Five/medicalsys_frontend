import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { ROLE_SCOPE } from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { Role } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { orderRoles } from './access-matrix';
import { ROLE_STATE } from './access-rules';
import { NewRoleSheet } from './new-role-sheet';

/**
 * Roles de la plataforma.
 *
 * Un rol es una función de trabajo: agrupa permisos del catálogo y las cuentas
 * lo reciben entero. Desde aquí se crea uno nuevo y se abre su ficha; los
 * permisos de todos los roles se ven y se editan juntos en la matriz.
 */
@Component({
  selector: 'medsys-roles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    NewRoleSheet,
    RouterLink,
    Icon,
  ],
  templateUrl: './roles-page.html',
})
export class RolesPage {
  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly scopes = ROLE_SCOPE;
  protected readonly states = ROLE_STATE;
  protected readonly canManage = computed(() => can.manageRoles(this.session.permissions()));
  protected readonly creating = signal(false);

  protected readonly roles = this.access.rolesResource();
  protected readonly ordered = computed(() => orderRoles(this.roles.value() ?? []));

  protected readonly countLabel = computed(() => {
    const total = this.ordered().length;
    const active = this.ordered().filter((role) => role.active).length;
    return `${total} ${total === 1 ? 'rol' : 'roles'} · ${active} ${active === 1 ? 'activo' : 'activos'}`;
  });

  protected delegation(role: Role): string {
    if (role.scope === 'PLATFORM') {
      return 'Cualquier rol';
    }
    const total = role.assignableRoles.length;
    return total === 0 ? 'Ninguno' : total === 1 ? '1 rol' : `${total} roles`;
  }

  protected open(code: string): void {
    void this.router.navigate(['/roles', code]);
  }

  protected onRowKey(event: KeyboardEvent, code: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(code);
    }
  }
}
