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
import { HttpErrorResponse } from '@angular/common/http';
import { describeFailure } from '../../core/http/api-error';
import { DEPARTMENT, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Select } from '../../shared/select';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { TenancyService } from './tenancy.service';
import { Branch, Department } from './tenancy.models';

const PHONE = /^\+?[0-9]{6,19}$/;
const CODE = /^[A-Za-z0-9_-]+$/;

/**
 * Alta y edición de sede.
 *
 * Las validaciones replican exactamente las del backend (longitudes, patrón del
 * código, formato E.164). Validar aquí lo mismo que allí evita que el usuario
 * descubra el límite después de haber enviado el formulario.
 */
@Component({
  selector: 'medsys-branch-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Select, Icon, ReactiveFormsModule, Dialog, Notice],
  templateUrl: './branch-form.html',
})
export class BranchForm {
  readonly open = input(false);
  readonly branch = input<Branch | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly departments = options(DEPARTMENT).filter((o) => o.value !== 'FOREIGN');
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly isEdit = computed(() => this.branch() !== null);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(CODE)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    headquarters: [false],
    address: ['', [Validators.required, Validators.maxLength(250)]],
    city: ['', [Validators.required, Validators.maxLength(80)]],
    department: ['LA_PAZ', [Validators.required]],
    phoneE164: ['', [Validators.pattern(PHONE)]],
    openingHours: ['', [Validators.maxLength(500)]],
  });

  protected readonly conflict = computed(() => {
    const failure = this.failure();
    return failure instanceof HttpErrorResponse && failure.status === 409
      ? describeFailure(failure).message
      : null;
  });

  protected readonly otherError = computed(() => {
    const failure = this.failure();
    if (failure === null || this.conflict() !== null) {
      return null;
    }
    return describeFailure(failure).message;
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const branch = this.branch();
      this.failure.set(null);
      this.form.reset(
        branch
          ? {
              code: branch.code,
              name: branch.name,
              headquarters: branch.headquarters,
              address: branch.address,
              city: branch.city,
              department: branch.department,
              phoneE164: branch.phoneE164 ?? '',
              openingHours: branch.openingHours ?? '',
            }
          : {
              code: '',
              name: '',
              headquarters: false,
              address: '',
              city: '',
              department: 'LA_PAZ',
              phoneE164: '',
              openingHours: '',
            },
      );
      // El código identifica la sede en otras bases: una vez creada no se edita.
      if (branch) {
        this.form.controls.code.disable();
      } else {
        this.form.controls.code.enable();
      }
    });
  }

  protected errorFor(control: 'code' | 'name' | 'address' | 'city' | 'phoneE164'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    if (field.hasError('pattern')) {
      return control === 'phoneE164'
        ? 'Escríbelo en formato internacional, por ejemplo +59170000000'
        : 'Solo letras, dígitos, guion y guion bajo';
    }
    return null;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      // El foco salta al primer campo inválido en vez de dejar al usuario
      // buscando cuál de ellos falló.
      document.querySelector<HTMLElement>('medsys-branch-form [aria-invalid="true"]')?.focus();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      address: value.address,
      city: value.city,
      department: value.department as Department,
      phoneE164: value.phoneE164 || null,
      openingHours: value.openingHours || null,
    };

    this.pending.set(true);
    this.failure.set(null);
    try {
      const branch = this.branch();
      const saved = branch
        ? await this.tenancy.updateBranch(branch.id, payload)
        : await this.tenancy.createBranch({
            ...payload,
            code: value.code,
            headquarters: value.headquarters,
          });
      this.toasts.notify(
        branch
          ? `Se guardaron los cambios de ${saved.name}.`
          : `La sucursal ${saved.name} quedó registrada.`,
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
