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
import { REQUIRED_RESOURCE_TYPE, SERVICE_OFFERING_TYPE, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Select } from '../../shared/select';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { TenancyService } from './tenancy.service';
import { ServiceOffering } from './tenancy.models';
import { NumberField } from '../../shared/number-field';

const CODE = /^[A-Za-z0-9_-]+$/;

/**
 * Alta y edición de prestación. Los límites replican los CHECK del diccionario
 * de datos: duración entre 5 y 720 minutos e importe no negativo.
 */
@Component({
  selector: 'medsys-offering-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Select, Icon, ReactiveFormsModule, Dialog, Notice, NumberField],
  templateUrl: './offering-form.html',
})
export class OfferingForm {
  readonly open = input(false);
  readonly offering = input<ServiceOffering | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly types = options(SERVICE_OFFERING_TYPE);
  protected readonly resources = options(REQUIRED_RESOURCE_TYPE);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly isEdit = computed(() => this.offering() !== null);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(CODE)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(500)]],
    type: ['CONSULTATION', [Validators.required]],
    specialtyCode: ['', [Validators.maxLength(20)]],
    durationMinutes: ['30', [Validators.min(5), Validators.max(720)]],
    basePriceBob: ['', [Validators.required, Validators.min(0)]],
    requiresConsent: [false],
    requiredResourceType: ['NONE'],
    taxProductCode: ['', [Validators.maxLength(30)]],
    taxUnitCode: ['58', [Validators.maxLength(10)]],
  });

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
      const offering = this.offering();
      this.failure.set(null);
      this.form.reset(
        offering
          ? {
              code: offering.code,
              name: offering.name,
              description: offering.description ?? '',
              type: offering.type,
              specialtyCode: offering.specialtyCode ?? '',
              durationMinutes: offering.durationMinutes ? String(offering.durationMinutes) : '',
              basePriceBob: offering.basePriceBob,
              requiresConsent: offering.requiresConsent,
              requiredResourceType: offering.requiredResourceType ?? 'NONE',
              taxProductCode: offering.taxProductCode ?? '',
              taxUnitCode: offering.taxUnitCode ?? '',
            }
          : {
              code: '',
              name: '',
              description: '',
              type: 'CONSULTATION',
              specialtyCode: '',
              durationMinutes: '30',
              basePriceBob: '',
              requiresConsent: false,
              requiredResourceType: 'NONE',
              taxProductCode: '',
              taxUnitCode: '58',
            },
      );
      if (offering) {
        this.form.controls.code.disable();
      } else {
        this.form.controls.code.enable();
      }
    });
  }

  protected errorFor(control: 'code' | 'name' | 'basePriceBob' | 'durationMinutes'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    if (field.hasError('pattern')) return 'Solo letras, dígitos, guion y guion bajo';
    if (control === 'durationMinutes') return 'La duración debe estar entre 5 y 720 minutos';
    if (control === 'basePriceBob') return 'El precio no puede ser negativo';
    return null;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      document.querySelector<HTMLElement>('medsys-offering-form [aria-invalid="true"]')?.focus();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      description: value.description || null,
      type: value.type,
      specialtyCode: value.specialtyCode || null,
      durationMinutes: value.durationMinutes ? Number(value.durationMinutes) : null,
      basePriceBob: Number(value.basePriceBob).toFixed(2),
      requiresConsent: value.requiresConsent,
      requiredResourceType: value.requiredResourceType || null,
      taxProductCode: value.taxProductCode || null,
      taxUnitCode: value.taxUnitCode || null,
    };

    this.pending.set(true);
    this.failure.set(null);
    try {
      const offering = this.offering();
      const saved = offering
        ? await this.tenancy.updateOffering(offering.id, payload)
        : await this.tenancy.createOffering({ ...payload, code: value.code });
      this.toasts.notify(
        offering
          ? `Se guardaron los cambios de ${saved.name}.`
          : `${saved.name} ya está en el catálogo.`,
      );
      this.saved.emit();
      this.closed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
