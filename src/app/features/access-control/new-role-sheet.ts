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
import { ToastService } from '../../core/toast/toast.service';
import { Dialog } from '../../shared/dialog';
import { Select } from '../../shared/select';
import { Role, RoleScope } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { accessFailure, searchText } from './access-presentation';

@Component({
  selector: 'medsys-new-role-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'access-feature' },
  imports: [ReactiveFormsModule, Dialog, Select],
  templateUrl: './new-role-sheet.html',
  styleUrl: './access-form.scss',
})
export class NewRoleSheet {
  readonly open = input(false);
  readonly existingRoles = input<readonly Role[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();
  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly pending = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly duplicate = signal(false);
  protected readonly canChooseScope = computed(() =>
    this.existingRoles().some(
      (role) => role.scope === 'PLATFORM' && this.session.roles().includes(role.code),
    ),
  );
  protected readonly scopes = [
    { value: 'ORGANIZATION', label: 'Una organización y sus sucursales' },
    { value: 'PLATFORM', label: 'Toda la plataforma' },
  ];
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    description: ['', Validators.maxLength(300)],
    scope: ['ORGANIZATION'],
  });
  private generatedCode = '';
  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ name: '', description: '', scope: 'ORGANIZATION' });
        this.failure.set(null);
        this.duplicate.set(false);
        this.generatedCode = '';
      }
    });
  }
  protected errorFor(control: 'name' | 'description'): string | null {
    const field = this.form.controls[control];
    if (control === 'name' && this.duplicate())
      return 'Ya hay un rol con este nombre. Elige uno que permita distinguirlo.';
    if (!field.touched || field.valid) return null;
    if (field.hasError('required') || field.hasError('pattern'))
      return 'Escribe el nombre del rol.';
    return control === 'name'
      ? 'Usa un nombre de hasta 80 caracteres.'
      : 'La descripción puede tener hasta 300 caracteres.';
  }
  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) return;
    const value = this.form.getRawValue();
    this.duplicate.set(
      this.existingRoles().some((role) => searchText(role.name) === searchText(value.name)),
    );
    if (this.duplicate()) return;
    this.pending.set(true);
    this.failure.set(null);
    this.generatedCode ||=
      'CUSTOM_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase();
    try {
      const role = await this.access.createRole({
        code: this.generatedCode,
        name: value.name.trim(),
        description: value.description.trim() || null,
        scope: (this.canChooseScope() ? value.scope : 'ORGANIZATION') as RoleScope,
      });
      this.toasts.notify(`${role.name} creado. Ahora puedes elegir sus accesos.`);
      this.saved.emit();
      this.closed.emit();
      await this.router.navigate(['/roles'], { queryParams: { rol: role.code } });
    } catch (failure) {
      this.failure.set(accessFailure(failure, this.existingRoles()));
    } finally {
      this.pending.set(false);
    }
  }
}
