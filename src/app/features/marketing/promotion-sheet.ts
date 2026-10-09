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
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeFailure } from '../../core/http/api-error';
import { todayIso } from '../../core/format/format';
import { DISCOUNT_TYPE, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { DateField } from '../../shared/date-field';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select, SelectOption } from '../../shared/select';
import { TenancyService } from '../tenancy/tenancy.service';
import { MarketingService } from './marketing.service';
import { NumberField } from '../../shared/number-field';

const CODE = /^[A-Za-z0-9_-]+$/;

/**
 * Alta de cupón.
 *
 * El código se restringe a mayúsculas, dígitos, guion y guion bajo, igual que en
 * el servicio: un cupón se dicta por teléfono y se teclea en un mostrador, así
 * que admitir espacios o acentos solo garantiza validaciones fallidas que el
 * paciente vive como un error del sistema.
 */
@Component({
  selector: 'medsys-promotion-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Notice, Select, DateField, ReactiveFormsModule, NumberField],
  templateUrl: './promotion-sheet.html',
})
export class PromotionSheet {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly marketing = inject(MarketingService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly discountTypes = options(DISCOUNT_TYPE);

  private readonly activeOfferings = signal<boolean | null>(true);
  private readonly offerings = this.tenancy.offeringsResource(this.activeOfferings);

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly form = this.fb.nonNullable.group({
    couponCode: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(CODE)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(500)]],
    discountType: ['PERCENTAGE', [Validators.required]],
    value: ['', [Validators.required, Validators.min(0)]],
    serviceOfferingId: [''],
    maxRedemptions: [''],
    redemptionsPerPatient: ['1', [Validators.min(1), Validators.max(255)]],
    validFrom: [todayIso(), [Validators.required]],
    validUntil: ['', [Validators.required]],
  });

  protected readonly offeringOptions = computed<readonly SelectOption[]>(() =>
    (this.offerings.value()?.content ?? []).map((offering) => ({
      value: offering.id,
      label: offering.name,
    })),
  );

  protected readonly isPercentage = computed(
    () => this.form.controls.discountType.value === 'PERCENTAGE',
  );
  protected readonly isFreeService = computed(
    () => this.form.controls.discountType.value === 'FREE_SERVICE',
  );

  protected readonly conflict = computed(() => {
    const failure = this.failure();
    return failure instanceof HttpErrorResponse && failure.status === 409
      ? describeFailure(failure).message
      : null;
  });

  protected readonly otherError = computed(() => {
    const failure = this.failure();
    return failure !== null && this.conflict() === null ? describeFailure(failure).message : null;
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      this.failure.set(null);
      this.form.reset({
        couponCode: '',
        name: '',
        description: '',
        discountType: 'PERCENTAGE',
        value: '',
        serviceOfferingId: '',
        maxRedemptions: '',
        redemptionsPerPatient: '1',
        validFrom: todayIso(),
        validUntil: '',
      });
    });
  }

  protected errorFor(control: 'couponCode' | 'name' | 'value' | 'validUntil'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    if (field.hasError('pattern')) return 'Solo letras, dígitos, guion y guion bajo';
    if (field.hasError('min')) return 'No puede ser negativo';
    return null;
  }

  /** Las mismas reglas que aplica el servicio, adelantadas para no ir y volver. */
  protected readonly ruleError = computed(() => {
    const raw = this.form.getRawValue();
    const value = Number(raw.value);
    if (raw.discountType === 'PERCENTAGE' && Number.isFinite(value) && value > 100) {
      return 'Un descuento porcentual no puede superar el 100 %.';
    }
    if (raw.discountType === 'FREE_SERVICE' && raw.serviceOfferingId === '') {
      return 'Un cupón de prestación gratis debe indicar a qué prestación aplica.';
    }
    if (raw.validFrom !== '' && raw.validUntil !== '' && raw.validUntil < raw.validFrom) {
      return 'La vigencia no puede terminar antes de empezar.';
    }
    return null;
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.ruleError() !== null) {
      return;
    }
    const raw = this.form.getRawValue();

    this.pending.set(true);
    this.failure.set(null);
    try {
      const promotion = await this.marketing.createPromotion({
        couponCode: raw.couponCode.trim().toUpperCase(),
        name: raw.name.trim(),
        description: raw.description.trim() === '' ? null : raw.description.trim(),
        discountType: raw.discountType,
        value: Number(raw.value),
        serviceOfferingId: raw.serviceOfferingId === '' ? null : raw.serviceOfferingId,
        maxRedemptions: raw.maxRedemptions === '' ? null : Number(raw.maxRedemptions),
        redemptionsPerPatient: Number(raw.redemptionsPerPatient || '1'),
        validFrom: raw.validFrom,
        validUntil: raw.validUntil,
      });
      this.toasts.notify(`Cupón ${promotion.couponCode} creado.`);
      this.saved.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
