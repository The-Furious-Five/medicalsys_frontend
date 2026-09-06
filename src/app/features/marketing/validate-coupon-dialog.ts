import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { DISCOUNT_TYPE, label } from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { PatientPicker } from '../patients/patient-picker';
import { MarketingService } from './marketing.service';
import { CouponValidation } from './marketing.models';

/**
 * Comprobador de cupones para el mostrador.
 *
 * Es la misma llamada que hace ms-facturacion antes de aplicar un descuento, y
 * **no consume el cupón**: mostrar cuánto descuenta no puede gastarlo. El canje
 * ocurre al emitir la factura, con el identificador de la factura como clave de
 * idempotencia.
 *
 * Un cupón que no aplica no es un error: se responde con el motivo, porque para
 * quien está cobrando «este cupón no sirve» es una respuesta del flujo, no un
 * fallo de la petición.
 */
@Component({
  selector: 'medsys-validate-coupon-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Notice, PatientPicker, Icon, ...FORMAT_PIPES],
  templateUrl: './validate-coupon-dialog.html',
})
export class ValidateCouponDialog {
  readonly open = input(false);
  readonly initialCode = input<string | null>(null);
  readonly closed = output<void>();

  private readonly marketing = inject(MarketingService);

  protected readonly code = signal('');
  protected readonly patientId = signal<string | null>(null);
  protected readonly baseAmount = signal('');
  protected readonly pending = signal(false);
  protected readonly result = signal<CouponValidation | null>(null);
  protected readonly failure = signal<unknown>(null);

  protected readonly discountTypeLabel = computed(() => {
    const type = this.result()?.discountType;
    return type ? label(DISCOUNT_TYPE, type) : null;
  });

  protected readonly ready = computed(
    () =>
      this.code().trim() !== '' &&
      this.patientId() !== null &&
      Number(this.baseAmount()) >= 0 &&
      this.baseAmount().trim() !== '',
  );

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      this.code.set(this.initialCode() ?? '');
      this.result.set(null);
      this.failure.set(null);
    });
  }

  protected async validate(): Promise<void> {
    if (!this.ready()) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      this.result.set(
        await this.marketing.validateCoupon({
          couponCode: this.code().trim().toUpperCase(),
          patientId: this.patientId()!,
          serviceOfferingId: null,
          baseAmountBob: Number(this.baseAmount()),
        }),
      );
    } catch (failure) {
      this.result.set(null);
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
