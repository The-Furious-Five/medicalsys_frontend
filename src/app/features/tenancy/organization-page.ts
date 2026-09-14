import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import {
  BRANCH_STATUS,
  DEPARTMENT,
  ORGANIZATION_STATUS,
  ORGANIZATION_TYPE,
  label,
} from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { BranchForm } from './branch-form';
import { OrganizationForm } from './organization-form';
import { TenancyService } from './tenancy.service';
import { Branch, Organization } from './tenancy.models';

/**
 * Jerarquía: la ficha del centro es contexto — se lee una vez y se consulta
 * poco; las sucursales son trabajo — se editan y cambian de estado. Por eso la
 * ficha ocupa una tarjeta compacta arriba y la tabla de sedes el resto del alto.
 */
@Component({
  selector: 'medsys-organization-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    Skeleton,
    TableSkeleton,
    ConfirmDialog,
    BranchForm,
    OrganizationForm,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './organization-page.html',
})
export class OrganizationPage {
  private readonly tenancy = inject(TenancyService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly branchStatuses = BRANCH_STATUS;
  protected readonly organizationStatuses = ORGANIZATION_STATUS;
  protected readonly editable = computed(() => can.manageOrganization(this.session.roles()));

  protected readonly organization = this.tenancy.organizationResource();
  protected readonly branches = this.tenancy.branchesResource();

  protected readonly editingOrganization = signal(false);
  protected readonly branchFormOpen = signal(false);
  protected readonly editingBranch = signal<Branch | null>(null);
  protected readonly deactivating = signal<Branch | null>(null);
  protected readonly statusPending = signal(false);

  protected openNewBranch(): void {
    this.editingBranch.set(null);
    this.branchFormOpen.set(true);
  }

  protected openEditBranch(branch: Branch): void {
    this.editingBranch.set(branch);
    this.branchFormOpen.set(true);
  }

  protected typeLabel(organization: Organization): string {
    return label(ORGANIZATION_TYPE, organization.type);
  }

  protected departmentLabel(department: string | null): string {
    return label(DEPARTMENT, department);
  }

  protected locationOf(organization: Organization): string {
    return (
      [organization.city, label(DEPARTMENT, organization.department, '')]
        .filter(Boolean)
        .join(', ') || '—'
    );
  }

  protected async changeStatus(branch: Branch, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    this.statusPending.set(true);
    try {
      const updated = await this.tenancy.changeBranchStatus(branch.id, status);
      this.branches.reload();
      this.deactivating.set(null);
      this.toasts.notify(
        updated.status === 'ACTIVE'
          ? `La sucursal ${updated.name} volvió a estar activa.`
          : `La sucursal ${updated.name} quedó inactiva.`,
      );
    } catch {
      this.toasts.notify('No se pudo cambiar el estado de la sucursal.', 'err');
    } finally {
      this.statusPending.set(false);
    }
  }
}
