import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { formatDocument } from '../../core/format/format';
import {
  EMISSION_TYPE,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  TAX_DOCUMENT_TYPE,
  label,
} from '../../core/labels/labels';
import { invoiceTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { PatientName } from '../patients/patient-name';
import { BillingService } from './billing.service';
import { DemoCaption } from './demo-caption';
import { Invoice } from './billing.models';

/**
 * Jerarquía: esto es un documento, no un panel. Se lee de arriba abajo como se
 * leería en papel — emisor, receptor, detalle, total — y la leyenda de
 * demostración encabeza todo para que nadie la confunda con una factura real.
 */
@Component({
  selector: 'medsys-invoice-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    Skeleton,
    PatientName,
    DemoCaption,
    Icon,
    RouterLink,
    ...FORMAT_PIPES,
  ],
  templateUrl: './invoice-detail-page.html',
})
export class InvoiceDetailPage {
  /** Llega por `withComponentInputBinding` desde el parámetro de ruta. */
  readonly invoiceId = input.required<string>();

  private readonly billing = inject(BillingService);

  protected readonly invoiceStatuses = INVOICE_STATUS;
  protected readonly invoiceTones = invoiceTone;

  protected readonly invoice = this.billing.invoiceResource(
    computed(() => this.invoiceId() ?? null),
  );

  protected readonly crumbs = computed(() => [
    { label: 'Facturas', link: '/facturas' },
    { label: `Nº ${this.invoice.value()?.invoiceNumber ?? ''}` },
  ]);

  protected documentType(invoice: Invoice): string {
    return label(TAX_DOCUMENT_TYPE, invoice.taxDocumentType);
  }

  protected emissionType(invoice: Invoice): string {
    return label(EMISSION_TYPE, invoice.emissionType);
  }

  protected paymentMethod(invoice: Invoice): string {
    return invoice.paymentMethodCode === null
      ? '—'
      : label(PAYMENT_METHOD, String(invoice.paymentMethodCode));
  }

  protected customerDocument(invoice: Invoice): string {
    const customer = invoice.customer;
    if (!customer?.documentNumber) {
      return 'Sin documento registrado';
    }
    const document = formatDocument(customer.documentNumber, customer.documentComplement);
    return `Documento ${document}${customer.email ? ` · ${customer.email}` : ''}`;
  }

  protected print(): void {
    window.print();
  }
}
