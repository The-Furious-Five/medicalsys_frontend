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
import { describeFailure } from '../../core/http/api-error';
import { ROLE_SCOPE, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select } from '../../shared/select';
import { RoleScope } from './access-control.models';
import { AccessControlService } from './access-control.service';

/** El mismo patrón que valida ms-identidad (y el CHECK de la tabla). */
const ROLE_CODE = /^[A-Z][A-Z0-9_]{2,29}$/;

/**
 * Alta de un rol.
 *
 * El rol nace activo, sin permisos y sin delegar: nadie lo recibe con acceso
 * por accidente. Los permisos se marcan después en la matriz, y quién puede
 * asignarlo se decide en su ficha.
 *
 * El código se escribe en mayúsculas a medida que se teclea, porque viaja en el
 * token y en `X-Roles` y el servicio no lo deja cambiar después.
 */
@Component({
  selector: 'medsys-new-role-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Dialog, Notice, Select],
  templateUrl: './new-role-sheet.html',
})
export class NewRoleSheet {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly access = inject(AccessControlService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly scopes = options(ROLE_SCOPE);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly duplicated = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(ROLE_CODE)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(300)]],
    scope: ['ORGANIZATION', [Validators.required]],
  });

  protected readonly otherError = computed(() => {
    const failure = this.failure();
    return failure === null || this.duplicated() !== null ? null : describeFailure(failure).message;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ scope: 'ORGANIZATION' });
        this.failure.set(null);
        this.duplicated.set(null);
      }
    });
  }

  protected onCode(event: Event): void {
    const field = event.target as HTMLInputElement;
    const upper = field.value.toUpperCase().replace(/\s+/g, '_');
    if (upper !== field.value) {
      this.form.controls.code.setValue(upper);
    }
    this.duplicated.set(null);
  }

  protected errorFor(control: 'code' | 'name' | 'description'): string | null {
    const field = this.form.controls[control];
    if (control === 'code' && this.duplicated() !== null) {
      return `Ya existe un rol con el código ${this.duplicated()}`;
    }
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('pattern')) {
      return 'De 3 a 30 caracteres: mayúsculas, dígitos o guion bajo, empezando por una letra';
    }
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    return null;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      document.querySelector<HTMLElement>('medsys-new-role-sheet [aria-invalid="true"]')?.focus();
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.failure.set(null);
    try {
      const role = await this.access.createRole({
        code: value.code,
        name: value.name.trim(),
        description: value.description.trim() || null,
        scope: value.scope as RoleScope,
      });
      this.toasts.notify(`El rol ${role.code} quedó creado, todavía sin permisos.`);
      this.saved.emit();
      this.closed.emit();
      await this.router.navigate(['/roles', role.code]);
    } catch (failure) {
      this.failure.set(failure);
      if (failure instanceof HttpErrorResponse && failure.status === 409) {
        this.duplicated.set(value.code);
      }
    } finally {
      this.pending.set(false);
    }
  }
}
