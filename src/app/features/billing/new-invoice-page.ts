import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { formatBob } from '../../core/format/format';
import { PAYMENT_METHOD, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { PatientPicker } from '../patients/patient-picker';
import { TenancyService } from '../tenancy/tenancy.service';
import { ServiceOffering } from '../tenancy/tenancy.models';
import { BillingService } from './billing.service';
import { Select, SelectOption } from '../../shared/select';
import { DemoCaption } from './demo-caption';
import { NumberField } from '../../shared/number-field';

interface Line {
  readonly key: string;
  readonly offering: ServiceOffering;
  quantity: number;
  discount: string;
}

/**
 * Jerarquía: emitir una factura son tres decisiones — a quién, qué y cómo se
 * paga. Se presentan en ese orden, en una sola columna, con el total siempre
 * visible a la derecha para que nadie emita sin saber cuánto está cobrando.
 */
@Component({
  selector: 'medsys-new-invoice-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    PatientPicker,
    DemoCaption,
    Notice,
    Skeleton,
    Icon,
    RouterLink,
    ...FORMAT_PIPES,
    NumberField,
  ],
  templateUrl: './new-invoice-page.html',
})
export class NewInvoicePage {
  private readonly billing = inject(BillingService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly paymentMethods = options(PAYMENT_METHOD);
  private readonly activeOnly = signal<boolean | null>(true);
  private readonly activeBranches = signal<string | null>('ACTIVE');

  protected readonly offerings = this.tenancy.offeringsResource(this.activeOnly);
  protected readonly branches = this.tenancy.branchesResource(this.activeBranches);

  protected readonly patientId = signal<string | null>(null);
  protected readonly lines = signal<readonly Line[]>([]);
  protected readonly paymentMethod = signal('1');
  protected readonly branchId = signal('');
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly available = computed(() => this.offerings.value()?.content ?? []);

  /** El selector de «añadir prestación» no guarda valor: se usa como acción. */
  protected readonly offeringOptions = computed<readonly SelectOption[]>(() =>
    this.available().map((offering) => ({
      value: offering.id,
      label: this.offeringLabel(offering),
    })),
  );

  protected readonly branchOptions = computed<readonly SelectOption[]>(() =>
    (this.branches.value()?.content ?? []).map((branch) => ({
      value: branch.id,
      label: branch.name,
    })),
  );

  protected readonly totals = computed(() => {
    const lines = this.lines();
    const subtotal = lines.reduce(
      (sum, line) => sum + Number(line.offering.basePriceBob) * line.quantity,
      0,
    );
    const discount = lines.reduce((sum, line) => sum + (Number(line.discount) || 0), 0);
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
  });

  protected readonly ready = computed(() => this.patientId() !== null && this.lines().length > 0);

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  protected addOffering(offeringId: string): void {
    const offering = this.available().find((item) => item.id === offeringId);
    if (offering === undefined) {
      return;
    }
    this.lines.update((current) => {
      // Añadir dos veces la misma prestación suma cantidad; no duplica la línea.
      const existing = current.find((line) => line.offering.id === offering.id);
      if (existing !== undefined) {
        return current.map((line) =>
          line.offering.id === offering.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        { key: `${offering.id}-${Date.now()}`, offering, quantity: 1, discount: '' },
      ];
    });
  }

  protected changeQuantity(key: string, delta: number): void {
    this.lines.update((current) =>
      current.map((line) =>
        line.key === key ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line,
      ),
    );
  }

  protected setDiscount(key: string, value: string): void {
    this.lines.update((current) =>
      current.map((line) => (line.key === key ? { ...line, discount: value } : line)),
    );
  }

  protected removeLine(key: string): void {
    this.lines.update((current) => current.filter((line) => line.key !== key));
  }

  protected lineSubtotal(line: Line): string {
    return formatBob(
      Number(line.offering.basePriceBob) * line.quantity - (Number(line.discount) || 0),
    );
  }

  protected offeringLabel(offering: ServiceOffering): string {
    return `${offering.name} · ${formatBob(offering.basePriceBob)}`;
  }

  protected async issue(): Promise<void> {
    if (!this.ready()) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      const invoice = await this.billing.issue({
        patientId: this.patientId()!,
        branchId: this.branchId() || null,
        paymentMethodCode: Number(this.paymentMethod()),
        items: this.lines().map((line) => ({
          serviceOfferingId: line.offering.id,
          quantity: line.quantity.toFixed(4),
          discountAmount: line.discount ? Number(line.discount).toFixed(2) : '0.00',
        })),
      });
      this.toasts.notify(
        `Factura Nº ${invoice.invoiceNumber} emitida por ${formatBob(invoice.totalAmount)}.`,
      );
      await this.router.navigate(['/facturas', invoice.id], { replaceUrl: true });
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
