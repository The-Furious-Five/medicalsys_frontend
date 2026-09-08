import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { describeFailure } from '../../core/http/api-error';
import { RESOURCE_STATUS, RESOURCE_TYPE, label, options } from '../../core/labels/labels';
import { resourceTone } from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Dialog } from '../../shared/dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { TenancyService } from '../tenancy/tenancy.service';
import { PhysicalResource, ResourceStatus, ResourceType } from './scheduling.models';
import { SchedulingService } from './scheduling.service';
import { NumberField } from '../../shared/number-field';

/**
 * Consultorios, salas y equipos.
 *
 * Un recurso importa por una razón muy concreta: al agendar se reserva junto a
 * la cita, y dos citas no pueden compartirlo. Por eso la tabla enseña el estado
 * operativo antes que cualquier detalle descriptivo — un quirófano en
 * mantenimiento no se puede prometer a nadie.
 */
@Component({
  selector: 'medsys-resources-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    Icon,
    Dialog,
    Notice,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    NumberField,
  ],
  templateUrl: './resources-page.html',
})
export class ResourcesPage {
  private readonly scheduling = inject(SchedulingService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);

  protected readonly resourceTypes = RESOURCE_TYPE;
  protected readonly resourceStatuses = RESOURCE_STATUS;
  protected readonly resourceTones = resourceTone;
  protected readonly typeOptions = options(RESOURCE_TYPE);
  protected readonly statusOptions = options(RESOURCE_STATUS);

  protected readonly typeFilter = signal<string | null>(null);
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly branchFilter = signal<string | null>(null);

  private readonly branchStatus = signal<string | null>('ACTIVE');
  protected readonly branches = this.tenancy.branchesResource(this.branchStatus);
  protected readonly branchOptions = computed(
    () =>
      this.branches.value()?.content.map((branch) => ({ value: branch.id, label: branch.name })) ??
      [],
  );

  protected readonly list = this.scheduling.resourcesResource({
    branchId: this.branchFilter,
    type: this.typeFilter,
    status: this.statusFilter,
  });

  /* ----------------------------------------------------------- formulario */

  protected readonly editing = signal<PhysicalResource | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly type = signal<ResourceType>('OFFICE');
  protected readonly branchId = signal<string | null>(null);
  protected readonly floor = signal('');
  protected readonly peopleCapacity = signal('');
  protected readonly preparationMinutes = signal('');
  protected readonly requiresSterilization = signal(false);
  protected readonly equipment = signal('');

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly hasFilters = computed(
    () =>
      this.typeFilter() !== null || this.statusFilter() !== null || this.branchFilter() !== null,
  );

  protected readonly canSubmit = computed(
    () =>
      !this.pending() &&
      this.name().trim() !== '' &&
      (this.editing() !== null || (this.code().trim() !== '' && this.branchId() !== null)),
  );

  constructor() {
    effect(() => {
      const branches = this.branches.value()?.content ?? [];
      if (this.branchId() === null && branches.length > 0) {
        this.branchId.set((branches.find((branch) => branch.headquarters) ?? branches[0]).id);
      }
    });
  }

  protected branchName(id: string): string {
    return this.branches.value()?.content.find((branch) => branch.id === id)?.name ?? '—';
  }

  protected setType(value: string): void {
    this.type.set((value || 'OFFICE') as ResourceType);
  }

  protected startCreate(): void {
    this.editing.set(null);
    this.code.set('');
    this.name.set('');
    this.type.set('OFFICE');
    this.floor.set('');
    this.peopleCapacity.set('');
    this.preparationMinutes.set('');
    this.requiresSterilization.set(false);
    this.equipment.set('');
    this.failure.set(null);
    this.formOpen.set(true);
  }

  protected startEdit(resource: PhysicalResource): void {
    this.editing.set(resource);
    this.code.set(resource.code);
    this.name.set(resource.name);
    this.type.set(resource.type);
    this.branchId.set(resource.branchPublicId);
    this.floor.set(resource.floor ?? '');
    this.peopleCapacity.set(resource.peopleCapacity?.toString() ?? '');
    this.preparationMinutes.set(resource.preparationMinutes?.toString() ?? '');
    this.requiresSterilization.set(resource.requiresSterilization);
    this.equipment.set(resource.equipment ?? '');
    this.failure.set(null);
    this.formOpen.set(true);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    const shared = {
      name: this.name().trim(),
      type: this.type(),
      floor: this.floor().trim() || null,
      peopleCapacity: this.peopleCapacity() ? Number(this.peopleCapacity()) : null,
      preparationMinutes: this.preparationMinutes() ? Number(this.preparationMinutes()) : null,
      requiresSterilization: this.requiresSterilization(),
      equipment: this.equipment().trim() || null,
    };
    try {
      const current = this.editing();
      if (current === null) {
        await this.scheduling.createResource({
          organizationPublicId: this.scheduling.organizationId()!,
          branchPublicId: this.branchId()!,
          code: this.code().trim().toUpperCase(),
          ...shared,
        });
        this.toasts.notify('Recurso creado', 'ok');
      } else {
        await this.scheduling.updateResource(current.publicId, shared);
        this.toasts.notify('Recurso actualizado', 'ok');
      }
      this.formOpen.set(false);
      this.list.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async changeStatus(resource: PhysicalResource, status: string): Promise<void> {
    if (!status || status === resource.status) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.changeResourceStatus(resource.publicId, status as ResourceStatus);
      this.toasts.notify(`${resource.code}: ${label(RESOURCE_STATUS, status).toLowerCase()}`, 'ok');
      this.list.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected resetFilters(): void {
    this.typeFilter.set(null);
    this.statusFilter.set(null);
    this.branchFilter.set(null);
  }
}
