import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { INVOICE_STATUS } from '../../core/labels/labels';
import { invoiceTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientName } from '../patients/patient-name';
import { PatientPicker } from '../patients/patient-picker';
import { BillingService } from './billing.service';

/**
 * Jerarquía: el importe y el estado son lo que se busca en un listado de
 * facturas; el número identifica. El filtro por paciente vive en la URL para
 * que un enlace a «las facturas de esta persona» se pueda compartir.
 */
@Component({
  selector: 'medsys-invoices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    PatientName,
    PatientPicker,
    Icon,
    RouterLink,
    ...FORMAT_PIPES,
  ],
  templateUrl: './invoices-page.html',
})
export class InvoicesPage {
  private readonly billing = inject(BillingService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly invoiceStatuses = INVOICE_STATUS;
  protected readonly invoiceTones = invoiceTone;
  protected readonly canIssue = computed(() => can.issueInvoice(this.session.permissions()));

  protected readonly page = signal(0);
  protected readonly patientId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('paciente'))),
    { initialValue: null },
  );

  protected readonly invoices = this.billing.invoicesResource(this.patientId, this.page);

  protected onPatientChange(patientId: string | null): void {
    this.page.set(0);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patientId ? { paciente: patientId } : {},
      replaceUrl: true,
    });
  }

  protected openInvoice(invoiceId: string): void {
    void this.router.navigate(['/facturas', invoiceId]);
  }

  protected onRowKey(event: KeyboardEvent, invoiceId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openInvoice(invoiceId);
    }
  }
}
