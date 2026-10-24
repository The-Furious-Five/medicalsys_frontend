import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { Permission, can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { formatBytes, formatNumber, formatWeekday } from '../../core/format/format';
import {
  ENCOUNTER_STATUS,
  ENCOUNTER_TYPE,
  STUDY_ORDER_STATUS,
  USAGE_METRIC,
  label,
} from '../../core/labels/labels';
import { encounterTone, studyOrderTone } from '../../core/state/state-machines';
import { Icon, IconName } from '../../core/ui/icon';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { BillingService } from '../billing/billing.service';
import { RecordsService } from '../medical-records/records.service';
import { PatientName } from '../patients/patient-name';
import { TenancyService } from '../tenancy/tenancy.service';
import { PlanUsage } from '../tenancy/tenancy.models';

interface QuickAction {
  readonly icon: IconName;
  readonly label: string;
  readonly hint: string;
  readonly link: string;
  readonly permission: Permission;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    icon: 'user-plus',
    label: 'Registrar paciente',
    hint: 'Primera visita al centro',
    link: '/pacientes',
    permission: 'registerPatient',
  },
  {
    icon: 'stethoscope',
    label: 'Abrir encuentro',
    hint: 'Documentar una atención',
    link: '/encuentros',
    permission: 'openEncounter',
  },
  {
    icon: 'receipt',
    label: 'Emitir factura',
    hint: 'Cobrar prestaciones',
    link: '/facturas/nueva',
    permission: 'issueInvoice',
  },
  {
    icon: 'wallet',
    label: 'Prestaciones',
    hint: 'Catálogo y precios',
    link: '/prestaciones',
    permission: 'manageOfferings',
  },
];

/**
 * Jerarquía: el inicio no resume el sistema, resume el trabajo pendiente de
 * quien entra. Un profesional ve lo que le falta firmar; recepción, a quién
 * atender; administración, cómo va el centro.
 */
@Component({
  selector: 'medsys-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    Skeleton,
    ErrorState,
    PatientName,
    RouterLink,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly records = inject(RecordsService);
  private readonly billing = inject(BillingService);
  private readonly tenancy = inject(TenancyService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly encounterStatuses = ENCOUNTER_STATUS;
  protected readonly encounterTones = encounterTone;
  protected readonly orderStatuses = STUDY_ORDER_STATUS;
  protected readonly orderTones = studyOrderTone;

  protected readonly greeting = computed(() => {
    const fullName = this.session.user()?.fullName;
    return fullName ? fullName.trim().split(/\s+/)[0] : 'de nuevo';
  });
  protected readonly today = formatWeekday(new Date());

  protected readonly actions = computed(() =>
    QUICK_ACTIONS.filter((action) => can[action.permission](this.session.permissions())),
  );

  protected readonly showsDrafts = computed(() => can.writeNarrative(this.session.permissions()));
  protected readonly showsOrders = computed(() => can.viewStudyOrders(this.session.permissions()));
  protected readonly showsBilling = computed(() => can.viewInvoices(this.session.permissions()));
  protected readonly showsCentre = computed(() => can.viewUsage(this.session.permissions()));

  private readonly draftStatus = signal<string | null>('DRAFT');
  private readonly reportedStatus = signal<string | null>('REPORTED');
  private readonly firstPage = signal(0);
  private readonly noPatient = signal<string | null>(null);
  private readonly activeOnly = signal<boolean | null>(true);

  protected readonly drafts = this.records.encountersResource(
    this.draftStatus,
    this.firstPage,
    undefined,
    6,
  );
  protected readonly reported = this.records.studyOrdersResource(
    this.reportedStatus,
    this.firstPage,
    6,
  );
  protected readonly invoices = this.billing.invoicesResource(this.noPatient, this.firstPage, 5);
  protected readonly organization = this.tenancy.organizationResource();
  protected readonly usage = this.tenancy.usageResource();
  protected readonly offerings = this.tenancy.offeringsResource(this.activeOnly);

  protected typeLabel(type: string): string {
    return label(ENCOUNTER_TYPE, type);
  }

  protected metricLabel(metric: PlanUsage): string {
    return label(USAGE_METRIC, metric.metric);
  }

  protected metricValue(metric: PlanUsage): string {
    return metric.metric === 'STORAGE_BYTES'
      ? formatBytes(metric.currentValue)
      : formatNumber(metric.currentValue);
  }

  protected metricHint(metric: PlanUsage): string {
    if (metric.limit === null) {
      return 'sin límite';
    }
    const cap =
      metric.metric === 'STORAGE_BYTES' ? formatBytes(metric.limit) : formatNumber(metric.limit);
    return `de ${cap}`;
  }

  protected go(commands: unknown[]): void {
    void this.router.navigate(commands);
  }

  protected onRowKey(event: KeyboardEvent, commands: unknown[]): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.go(commands);
    }
  }
}
