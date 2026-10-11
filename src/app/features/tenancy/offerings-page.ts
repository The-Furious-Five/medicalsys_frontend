import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { REQUIRED_RESOURCE_TYPE, SERVICE_OFFERING_TYPE, label } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { TableSkeleton } from '../../shared/table-skeleton';
import { Select, SelectOption } from '../../shared/select';
import { OfferingForm } from './offering-form';
import { TenancyService } from './tenancy.service';
import { ServiceOffering } from './tenancy.models';

type ActiveFilter = 'all' | 'active' | 'inactive';

/**
 * Jerarquía: el precio es lo que se consulta y lo que se factura, así que va
 * alineado a la derecha, en cifra tabular y con la unidad siempre visible. El
 * filtro de vigencia arranca en «vigentes» porque es el catálogo que se usa.
 */
@Component({
  selector: 'medsys-offerings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    ErrorState,
    EmptyState,
    TableSkeleton,
    ConfirmDialog,
    OfferingForm,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './offerings-page.html',
})
export class OfferingsPage {
  private readonly tenancy = inject(TenancyService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly editable = computed(() => can.manageOfferings(this.session.permissions()));

  protected readonly vigencyOptions: readonly SelectOption[] = [
    { value: 'active', label: 'Solo vigentes' },
    { value: 'inactive', label: 'Solo no vigentes' },
    { value: 'all', label: 'Todas' },
  ];

  protected readonly term = signal('');
  protected readonly activeFilter = signal<ActiveFilter>(
    (localStorage.getItem('medicalsys.offerings.filter') as ActiveFilter | null) ?? 'active',
  );

  private readonly activeParam = computed<boolean | null>(() => {
    const filter = this.activeFilter();
    return filter === 'all' ? null : filter === 'active';
  });

  protected readonly offerings = this.tenancy.offeringsResource(this.activeParam);

  protected readonly rows = computed(() => {
    const all = this.offerings.value()?.content ?? [];
    const normalized = this.term().trim().toLowerCase();
    if (!normalized) {
      return all;
    }
    return all.filter((offering) =>
      `${offering.code} ${offering.name} ${offering.specialtyCode ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  });

  protected readonly filtersActive = computed(
    () => this.term().trim().length > 0 || this.activeFilter() !== 'all',
  );

  protected readonly hasAnyOffering = computed(
    () => (this.offerings.value()?.content.length ?? 0) > 0,
  );

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<ServiceOffering | null>(null);
  protected readonly deactivating = signal<ServiceOffering | null>(null);
  protected readonly statusPending = signal(false);

  constructor() {
    effect(() => localStorage.setItem('medicalsys.offerings.filter', this.activeFilter()));
  }

  protected typeLabel(offering: ServiceOffering): string {
    return label(SERVICE_OFFERING_TYPE, offering.type);
  }

  protected resourceLabel(offering: ServiceOffering): string {
    return label(REQUIRED_RESOURCE_TYPE, offering.requiredResourceType).toLowerCase();
  }

  protected filterDescription(): string {
    const scope =
      this.activeFilter() === 'active'
        ? 'vigentes'
        : this.activeFilter() === 'inactive'
          ? 'no vigentes'
          : 'del catálogo';
    const text = this.term() ? `«${this.term()}»` : 'sin texto';
    return `Se está buscando ${text} entre las prestaciones ${scope}.`;
  }

  protected clearFilters(): void {
    this.term.set('');
    this.activeFilter.set('all');
  }

  protected openNew(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(offering: ServiceOffering): void {
    this.editing.set(offering);
    this.formOpen.set(true);
  }

  protected async changeActive(offering: ServiceOffering, active: boolean): Promise<void> {
    this.statusPending.set(true);
    try {
      const updated = await this.tenancy.changeOfferingActive(offering.id, active);
      this.offerings.reload();
      this.deactivating.set(null);
      this.toasts.notify(
        updated.active
          ? `${updated.name} vuelve a estar vigente.`
          : `${updated.name} dejó de estar vigente y no se podrá facturar.`,
      );
    } catch {
      this.toasts.notify('No se pudo cambiar la vigencia de la prestación.', 'err');
    } finally {
      this.statusPending.set(false);
    }
  }
}
