import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { formatDocument } from '../../core/format/format';
import {
  CREDIT_DEBIT_NOTE_TYPE,
  EMISSION_TYPE,
  INVOICE_CANCELLATION_REASON,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  TAX_DOCUMENT_TYPE,
  label,
  options,
} from '../../core/labels/labels';
import { invoiceTone } from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Dialog } from '../../shared/dialog';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { NumberField } from '../../shared/number-field';
import { PageHeader } from '../../shared/page-header';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { PatientName } from '../patients/patient-name';
import { BillingService } from './billing.service';
import { CreditDebitNoteType, Invoice } from './billing.models';

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
    Icon,
    RouterLink,
    ConfirmDialog,
    Dialog,
    Notice,
    NumberField,
    Select,
    ...FORMAT_PIPES,
  ],
  templateUrl: './invoice-detail-page.html',
})
export class InvoiceDetailPage {
  /** Llega por `withComponentInputBinding` desde el parámetro de ruta. */
  readonly invoiceId = input.required<string>();

  private readonly billing = inject(BillingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly invoiceStatuses = INVOICE_STATUS;
  protected readonly invoiceTones = invoiceTone;
  protected readonly noteTypes = CREDIT_DEBIT_NOTE_TYPE;
  protected readonly cancellationReasons = options(INVOICE_CANCELLATION_REASON);

  protected readonly invoice = this.billing.invoiceResource(
    computed(() => this.invoiceId() ?? null),
  );
  protected readonly notes = this.billing.creditDebitNotesResource(
    computed(() => this.invoiceId() ?? null),
  );

  protected readonly canCorrect = computed(() => can.correctInvoice(this.session.roles()));
  protected readonly correctable = computed(() => {
    const status = this.invoice.value()?.status;
    return (
      this.canCorrect() && status !== undefined && status !== 'VOIDED' && status !== 'REJECTED'
    );
  });

  protected readonly voidOpen = signal(false);
  protected readonly voidReason = signal('1');
  protected readonly noteOpen = signal(false);
  protected readonly noteType = signal<CreditDebitNoteType>('CREDIT');
  protected readonly noteAmount = signal('');
  protected readonly noteReason = signal('');
  protected readonly actionPending = signal(false);
  protected readonly actionFailure = signal<unknown>(null);
  protected readonly actionFailureMessage = computed(() => {
    const failure = this.actionFailure();
    return failure === null ? null : describeFailure(failure);
  });

  protected readonly correctedBalance = computed(() =>
    (this.notes.value() ?? [])
      .filter((note) => note.status !== 'REJECTED' && note.status !== 'VOIDED')
      .reduce(
        (balance, note) =>
          balance + (note.type === 'DEBIT' ? Number(note.amount) : -Number(note.amount)),
        Number(this.invoice.value()?.totalAmount ?? 0),
      ),
  );

  protected readonly noteAmountTooHigh = computed(
    () =>
      this.noteType() === 'CREDIT' &&
      Number(this.noteAmount()) > 0 &&
      Number(this.noteAmount()) > this.correctedBalance(),
  );

  protected readonly noteReady = computed(
    () =>
      Number(this.noteAmount()) > 0 &&
      this.noteReason().trim().length > 0 &&
      !this.noteAmountTooHigh(),
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

  protected cancellationReason(invoice: Invoice): string {
    return invoice.cancellationReasonCode === null
      ? 'Motivo no informado'
      : label(INVOICE_CANCELLATION_REASON, String(invoice.cancellationReasonCode));
  }

  protected openNote(type: CreditDebitNoteType): void {
    this.noteType.set(type);
    this.noteAmount.set('');
    this.noteReason.set('');
    this.actionFailure.set(null);
    this.noteOpen.set(true);
  }

  protected async voidInvoice(): Promise<void> {
    this.actionPending.set(true);
    this.actionFailure.set(null);
    try {
      const updated = await this.billing.voidInvoice(this.invoiceId(), Number(this.voidReason()));
      this.voidOpen.set(false);
      this.toasts.notify(
        `Factura Nº ${updated.invoiceNumber} anulada. El comprobante se conserva.`,
      );
      this.invoice.reload();
    } catch (failure) {
      this.actionFailure.set(failure);
    } finally {
      this.actionPending.set(false);
    }
  }

  protected async issueNote(): Promise<void> {
    if (!this.noteReady()) {
      return;
    }
    this.actionPending.set(true);
    this.actionFailure.set(null);
    try {
      const note = await this.billing.issueCreditDebitNote(this.invoiceId(), {
        type: this.noteType(),
        amount: Number(this.noteAmount()).toFixed(2),
        reason: this.noteReason().trim(),
      });
      this.noteOpen.set(false);
      this.toasts.notify(
        `${label(CREDIT_DEBIT_NOTE_TYPE, note.type)} Nº ${note.noteNumber} emitida.`,
      );
      this.notes.reload();
    } catch (failure) {
      this.actionFailure.set(failure);
    } finally {
      this.actionPending.set(false);
    }
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
