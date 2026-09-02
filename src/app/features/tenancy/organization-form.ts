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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeFailure } from '../../core/http/api-error';
import { DEPARTMENT, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Select } from '../../shared/select';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { TenancyService } from './tenancy.service';
import { Organization } from './tenancy.models';

const PHONE = /^\+?[0-9]{6,19}$/;

@Component({
  selector: 'medsys-organization-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Select, ReactiveFormsModule, Dialog, Notice],
  templateUrl: './organization-form.html',
})
export class OrganizationForm {
  readonly open = input(false);
  readonly organization = input.required<Organization>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly departments = options(DEPARTMENT).filter((o) => o.value !== 'FOREIGN');
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly form = this.fb.nonNullable.group({
    tradeName: ['', [Validators.required, Validators.maxLength(180)]],
    legalName: ['', [Validators.required, Validators.maxLength(180)]],
    contactEmail: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phoneE164: ['', [Validators.pattern(PHONE)]],
    city: ['', [Validators.maxLength(80)]],
    department: [''],
    timeZone: ['America/La_Paz', [Validators.maxLength(40)]],
    tradeRegistryNumber: ['', [Validators.maxLength(40)]],
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const organization = this.organization();
      this.failure.set(null);
      this.form.reset({
        tradeName: organization.tradeName,
        legalName: organization.legalName,
        contactEmail: organization.contactEmail,
        phoneE164: organization.phoneE164 ?? '',
        city: organization.city ?? '',
        department: organization.department ?? '',
        timeZone: organization.timeZone,
        tradeRegistryNumber: organization.tradeRegistryNumber ?? '',
      });
    });
  }

  protected errorFor(
    control: 'tradeName' | 'legalName' | 'contactEmail' | 'phoneE164',
  ): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('email')) return 'Escribe un correo electrónico válido';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    if (field.hasError('pattern')) return 'Escríbelo en formato internacional';
    return null;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      document
        .querySelector<HTMLElement>('medsys-organization-form [aria-invalid="true"]')
        ?.focus();
      return;
    }

    const value = this.form.getRawValue();
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.tenancy.updateOrganization({
        legalName: value.legalName,
        tradeName: value.tradeName,
        contactEmail: value.contactEmail,
        phoneE164: value.phoneE164 || null,
        city: value.city || null,
        department: value.department || null,
        timeZone: value.timeZone || null,
        logoUrl: this.organization().logoUrl,
        tradeRegistryNumber: value.tradeRegistryNumber || null,
      });
      this.toasts.notify('Se guardaron los datos de la organización.');
      this.saved.emit();
      this.closed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
