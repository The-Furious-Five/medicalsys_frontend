import { HttpErrorResponse } from '@angular/common/http';
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
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { todayIso } from '../../core/format/format';
import { describeFailure } from '../../core/http/api-error';
import { PROFESSIONAL_TYPE, WORK_MODALITY, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select } from '../../shared/select';
import {
  ProfessionalDocumentType,
  ProfessionalTypeCode,
  WorkModality,
} from './professionals.models';
import { ProfessionalsService } from './professionals.service';

/** ms-profesionales acepta tres documentos, no los cinco de ms-pacientes. */
const DOCUMENT_TYPES = [
  { value: 'CI', label: 'Cédula de identidad' },
  { value: 'FOREIGN_ID_CARD', label: 'Carnet de extranjería' },
  { value: 'PASSPORT', label: 'Pasaporte' },
];

/**
 * Alta de profesional.
 *
 * Dos reglas del backend se sostienen desde aquí, cada una a su manera:
 *
 * · La matrícula es única. El servicio responde 409 y el conflicto se muestra
 *   sobre el campo de la matrícula, no en un aviso suelto arriba, y desaparece
 *   en cuanto se empieza a corregir.
 *
 * · Debe haber exactamente una especialidad principal. En vez de comprobarlo al
 *   enviar, la marca de «principal» es un radio: marcar dos es imposible antes
 *   de pulsar el botón. Al servidor solo puede llegar lo que él acepta.
 */
@Component({
  selector: 'medsys-register-professional-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateField, Select, ReactiveFormsModule, Dialog, Notice, Icon],
  templateUrl: './register-professional-sheet.html',
})
export class RegisterProfessionalSheet {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly professionals = inject(ProfessionalsService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly professionalTypes = options(PROFESSIONAL_TYPE);
  protected readonly modalities = options(WORK_MODALITY);

  protected readonly specialties = this.professionals.specialtiesResource();
  protected readonly accounts = this.professionals.userAccountsResource();

  protected readonly accountOptions = computed(() =>
    (this.accounts.value()?.content ?? []).map((account) => ({
      value: account.publicId,
      label: `${account.fullName} · ${account.email}`,
    })),
  );

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly conflictLicense = signal<string | null>(null);

  /** Códigos marcados y cuál de ellos es el principal. */
  protected readonly chosen = signal<readonly string[]>([]);
  protected readonly primary = signal<string | null>(null);
  /** Los avisos de las especialidades aparecen al primer intento de envío. */
  protected readonly attempted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    userAccountId: ['', [Validators.required]],
    documentType: ['CI', [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.maxLength(20)]],
    documentComplement: ['', [Validators.maxLength(5)]],
    givenNames: ['', [Validators.required, Validators.maxLength(120)]],
    paternalSurname: ['', [Validators.required, Validators.maxLength(80)]],
    maternalSurname: ['', [Validators.maxLength(80)]],
    professionalLicenseNumber: ['', [Validators.required, Validators.maxLength(40)]],
    professionalType: ['PHYSICIAN', [Validators.required]],
    biography: ['', [Validators.maxLength(1000)]],
    modality: ['FEE_BASED', [Validators.required]],
    commissionPercentage: ['', [Validators.min(0), Validators.max(100)]],
    startDate: ['', [Validators.required]],
  });

  protected readonly specialtyError = computed<string | null>(() => {
    if (!this.attempted()) {
      return null;
    }
    if (this.chosen().length === 0) {
      return 'Elige al menos una especialidad';
    }
    if (this.primary() === null) {
      return 'Marca cuál de las especialidades es la principal';
    }
    return null;
  });

  protected readonly otherError = computed(() => {
    const failure = this.failure();
    if (failure === null || this.conflictLicense() !== null) {
      return null;
    }
    return describeFailure(failure).message;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({
          documentType: 'CI',
          professionalType: 'PHYSICIAN',
          modality: 'FEE_BASED',
          startDate: todayIso(),
        });
        this.chosen.set([]);
        this.primary.set(null);
        this.attempted.set(false);
        this.failure.set(null);
        this.conflictLicense.set(null);
      }
    });

    // Al corregir la matrícula desaparece el conflicto: mantenerlo sería
    // acusar al usuario de un error que ya está enmendando.
    this.form.controls.professionalLicenseNumber.valueChanges.subscribe(() => {
      if (this.conflictLicense() !== null) {
        this.conflictLicense.set(null);
        this.form.controls.professionalLicenseNumber.setErrors(null);
      }
    });
  }

  protected isChosen(code: string): boolean {
    return this.chosen().includes(code);
  }

  /**
   * Al desmarcar la especialidad que era la principal, la marca se retira con
   * ella. Dejarla apuntando a una especialidad que ya no se envía haría que el
   * formulario se viera válido y el servidor lo rechazara igual.
   */
  protected toggle(code: string, checked: boolean): void {
    this.chosen.update((current) =>
      checked ? [...current, code] : current.filter((item) => item !== code),
    );
    if (!checked && this.primary() === code) {
      this.primary.set(null);
    }
    if (checked && this.chosen().length === 1) {
      this.primary.set(code);
    }
  }

  protected errorFor(
    control:
      | 'userAccountId'
      | 'documentNumber'
      | 'givenNames'
      | 'paternalSurname'
      | 'professionalLicenseNumber'
      | 'commissionPercentage'
      | 'startDate',
  ): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('duplicate')) return 'Ya existe un profesional con esta matrícula';
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('min') || field.hasError('max')) return 'La comisión va de 0 a 100';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    return null;
  }

  protected conflictText(): string {
    return (
      `No se pudo registrar: la matrícula ${this.conflictLicense() ?? ''} ya está en uso. ` +
      'El servicio devuelve el mismo conflicto para el documento y para la cuenta de usuario, ' +
      'así que conviene revisar también esos dos campos antes de reintentar.'
    );
  }

  protected async submit(): Promise<void> {
    this.attempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.specialtyError() !== null) {
      document
        .querySelector<HTMLElement>('medsys-register-professional-sheet [aria-invalid="true"]')
        ?.focus();
      return;
    }

    const organizationId = this.session.user()?.organizationPublicId;
    if (!organizationId) {
      return;
    }

    const value = this.form.getRawValue();
    const license = value.professionalLicenseNumber.trim();
    this.pending.set(true);
    this.failure.set(null);
    try {
      const professional = await this.professionals.register({
        userAccountId: value.userAccountId,
        documentType: value.documentType as ProfessionalDocumentType,
        documentNumber: value.documentNumber.trim(),
        documentComplement: value.documentComplement.trim() || null,
        givenNames: value.givenNames.trim(),
        paternalSurname: value.paternalSurname.trim(),
        maternalSurname: value.maternalSurname.trim() || null,
        professionalType: value.professionalType as ProfessionalTypeCode,
        professionalLicenseNumber: license,
        title: null,
        biography: value.biography.trim() || null,
        specialties: this.chosen().map((code) => ({
          code,
          primary: code === this.primary(),
          graduationYear: null,
        })),
        // El centro sale de la sesión y nunca de la pantalla. Ver el comentario
        // de `RegisterProfessionalInput`: hoy el backend lo exige en el cuerpo.
        organizationId,
        branchId: null,
        modality: value.modality as WorkModality,
        commissionPercentage:
          value.commissionPercentage === '' ? null : Number(value.commissionPercentage),
        startDate: value.startDate,
      });
      this.toasts.notify(`${professional.fullName} quedó registrado.`);
      this.saved.emit();
      this.closed.emit();
      await this.router.navigate(['/profesionales', professional.id]);
    } catch (failure) {
      this.failure.set(failure);
      if (failure instanceof HttpErrorResponse && failure.status === 409) {
        this.conflictLicense.set(license);
        this.form.controls.professionalLicenseNumber.setErrors({ duplicate: true });
      }
    } finally {
      this.pending.set(false);
    }
  }
}
