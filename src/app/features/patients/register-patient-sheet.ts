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
import { Router } from '@angular/router';
import { describeFailure } from '../../core/http/api-error';
import { formatDocument, todayIso } from '../../core/format/format';
import { DEPARTMENT, DOCUMENT_TYPE, SEX, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { PatientsService } from './patients.service';
import { Patient } from './patients.models';

const PHONE = /^\+?[0-9]{6,19}$/;

/**
 * Alta de paciente.
 *
 * El caso importante es el documento duplicado: el backend responde 409 y aquí
 * el conflicto se muestra sobre el campo del documento, con el nombre de quien
 * ya lo tiene y un acceso directo a su ficha. Registrar dos veces a la misma
 * persona es el error más caro de deshacer en una clínica.
 */
@Component({
  selector: 'medsys-register-patient-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Dialog, Notice],
  templateUrl: './register-patient-sheet.html',
})
export class RegisterPatientSheet {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly patients = inject(PatientsService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly documentTypes = options(DOCUMENT_TYPE);
  protected readonly sexes = options(SEX);
  protected readonly departments = options(DEPARTMENT);
  protected readonly maxBirthDate = todayIso();

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly duplicate = signal<Patient | null>(null);
  protected readonly conflictDocument = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    documentType: ['CI', [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.maxLength(20)]],
    documentComplement: ['', [Validators.maxLength(5)]],
    givenNames: ['', [Validators.required, Validators.maxLength(120)]],
    paternalSurname: ['', [Validators.required, Validators.maxLength(80)]],
    maternalSurname: ['', [Validators.maxLength(80)]],
    birthDate: ['', [Validators.required]],
    sex: ['UNDECLARED'],
    phoneE164: ['', [Validators.pattern(PHONE)]],
    email: ['', [Validators.email, Validators.maxLength(160)]],
    city: ['', [Validators.maxLength(80)]],
    department: [''],
    emergencyContactName: ['', [Validators.maxLength(160)]],
    emergencyContactPhone: ['', [Validators.pattern(PHONE)]],
  });

  protected readonly otherError = computed(() => {
    const failure = this.failure();
    if (failure === null || this.conflictDocument() !== null) {
      return null;
    }
    return describeFailure(failure).message;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ documentType: 'CI', sex: 'UNDECLARED' });
        this.failure.set(null);
        this.duplicate.set(null);
        this.conflictDocument.set(null);
      }
    });

    // Al corregir el documento desaparece el conflicto: mantenerlo sería
    // acusar al usuario de un error que ya está enmendando.
    this.form.controls.documentNumber.valueChanges.subscribe(() => {
      if (this.conflictDocument() !== null) {
        this.conflictDocument.set(null);
        this.duplicate.set(null);
        this.form.controls.documentNumber.setErrors(null);
      }
    });
  }

  protected errorFor(
    control:
      'documentNumber' | 'givenNames' | 'paternalSurname' | 'birthDate' | 'phoneE164' | 'email',
  ): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('duplicate')) return 'Ya existe un paciente con este documento';
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('email')) return 'Escribe un correo electrónico válido';
    if (field.hasError('future'))
      return 'La fecha de nacimiento no puede ser hoy ni una fecha futura';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    if (field.hasError('pattern'))
      return 'Escríbelo en formato internacional, por ejemplo +59170000000';
    return null;
  }

  protected conflictText(): string {
    const document = this.conflictDocument() ?? '';
    const person = this.duplicate();
    return person
      ? `No se pudo registrar el paciente: ya existe uno con el documento ${document}, a nombre de ${person.fullName}.`
      : `No se pudo registrar el paciente: ya existe uno con el documento ${document}.`;
  }

  protected goToDuplicate(): void {
    const person = this.duplicate();
    if (person === null) {
      return;
    }
    this.closed.emit();
    void this.router.navigate(['/pacientes', person.patientId]);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();

    const birthDate = this.form.controls.birthDate.value;
    if (birthDate && birthDate >= todayIso()) {
      this.form.controls.birthDate.setErrors({ future: true });
    }
    if (this.form.invalid) {
      document
        .querySelector<HTMLElement>('medsys-register-patient-sheet [aria-invalid="true"]')
        ?.focus();
      return;
    }

    const value = this.form.getRawValue();
    this.pending.set(true);
    this.failure.set(null);
    try {
      const patient = await this.patients.register({
        documentType: value.documentType,
        documentNumber: value.documentNumber.trim(),
        documentComplement: value.documentComplement.trim() || null,
        givenNames: value.givenNames.trim(),
        paternalSurname: value.paternalSurname.trim(),
        maternalSurname: value.maternalSurname.trim() || null,
        birthDate: value.birthDate,
        sex: value.sex || null,
        phoneE164: value.phoneE164 || null,
        email: value.email || null,
        city: value.city || null,
        department: value.department || null,
        emergencyContactName: value.emergencyContactName || null,
        emergencyContactPhone: value.emergencyContactPhone || null,
      });
      this.toasts.notify(`${patient.fullName} quedó registrado.`);
      this.saved.emit();
      this.closed.emit();
      await this.router.navigate(['/pacientes', patient.patientId]);
    } catch (failure) {
      this.failure.set(failure);
      if (failure instanceof HttpErrorResponse && failure.status === 409) {
        const document = formatDocument(
          value.documentNumber.trim(),
          value.documentComplement.trim(),
        );
        this.conflictDocument.set(document);
        this.form.controls.documentNumber.setErrors({ duplicate: true });
        // Se busca a quién pertenece el documento para poder ofrecer su ficha
        // en vez de dejar un mensaje sin salida.
        try {
          const page = await this.patients.search(value.documentNumber.trim(), 3);
          this.duplicate.set(page.content[0] ?? null);
        } catch {
          this.duplicate.set(null);
        }
      }
    } finally {
      this.pending.set(false);
    }
  }
}
