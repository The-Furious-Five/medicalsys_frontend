import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { Role } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { accessFailure, rolePurpose, roleName as displayRoleName } from './access-presentation';
import { orderRoles } from './access-matrix';
import { roleEditLock, grantsRoleAssignment } from './access-rules';

type Pending =
  | { readonly kind: 'deactivate' }
  | { readonly kind: 'reactivate' }
  | { readonly kind: 'unpair'; readonly other: string };

const sameMembers = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * Ajustes de un rol: información, estado, roles que puede asignar y
 * combinaciones incompatibles. Las funciones se editan en «Roles y accesos».
 *
 * Cada parte se guarda por separado y con su propio botón: guardar el nombre no
 * debe llevarse por delante una delegación a medio marcar.
 */
@Component({
  selector: 'medsys-role-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'access-feature' },
  imports: [Skeleton, ConfirmDialog, Select, ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './role-detail-page.html',
  styleUrl: './role-detail-page.scss',
})
export class RoleDetailPage {
  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly grantsRoleAssignment = grantsRoleAssignment;
  protected readonly purpose = rolePurpose;
  protected readonly settingsTab = signal('profile');
  protected readonly friendlyLock = computed(() =>
    this.current() && this.session.roles().includes(this.current()!.code)
      ? 'Estás usando este rol. Otra persona autorizada debe realizar sus cambios.'
      : 'Puedes consultar la información de este rol, pero no modificarla.',
  );

  protected readonly code = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('code'))),
    { initialValue: null },
  );
  protected readonly role = this.access.roleResource(this.code);
  protected readonly roles = this.access.rolesResource();
  protected readonly catalog = this.access.permissionsResource();
  protected readonly pairs = this.access.incompatibilitiesResource();

  /** El rol tal como lo conoce el servicio: el de la carga o el que devolvió el último guardado. */
  protected readonly current = linkedSignal<Role | null>(() => this.role.value() ?? null);

  protected readonly canManage = computed(() => can.manageRoles(this.session.permissions()));
  /** Por qué quien mira no puede editar este rol, o `null`. */
  protected readonly lock = computed(() => {
    const role = this.current();
    return role === null
      ? null
      : roleEditLock(role, this.session.roles(), this.session.permissions());
  });
  protected readonly editable = computed(() => this.canManage() && this.lock() === null);

  protected readonly crumbs = computed(() => [
    { label: 'Roles', link: '/roles' },
    { label: this.current()?.name ?? this.code() ?? '' },
  ]);

  protected readonly failure = signal<unknown>(null);
  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null
      ? null
      : accessFailure(failure, this.roles.value() ?? [], this.catalog.value() ?? []);
  });

  /* --------------------------------------------------------------- datos -- */

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(300)]],
  });
  private readonly savedData = computed(
    () => ({ name: this.current()?.name ?? '', description: this.current()?.description ?? '' }),
    { equal: (a, b) => a.name === b.name && a.description === b.description },
  );
  protected readonly savingData = signal(false);

  /* ---------------------------------------------------------- permisos -- */

  /* -------------------------------------------------------- delegación -- */

  private readonly savedDelegation = computed(() => this.current()?.assignableRoles ?? [], {
    equal: sameMembers,
  });
  /** Borrador de la delegación; vuelve a lo guardado solo cuando lo guardado cambia. */
  protected readonly delegation = linkedSignal<readonly string[]>(() => this.savedDelegation());
  protected readonly delegationDirty = computed(
    () => !sameMembers(this.delegation(), this.savedDelegation()),
  );
  /** Un rol de organización no delega roles de plataforma: el servicio responde 400. */
  protected readonly delegationOptions = computed(() =>
    orderRoles(this.roles.value() ?? []).filter(
      (role) =>
        role.scope === 'ORGANIZATION' && (role.active || this.delegation().includes(role.code)),
    ),
  );
  protected readonly savingDelegation = signal(false);

  /* -------------------------------------------------- incompatibilidades -- */

  protected readonly rolePairs = computed(() => {
    const code = this.current()?.code;
    return (this.pairs.value() ?? [])
      .filter((pair) => pair.roleA === code || pair.roleB === code)
      .map((pair) => ({ ...pair, other: pair.roleA === code ? pair.roleB : pair.roleA }));
  });

  /** Solo se emparejan roles que quien edita también puede editar. */
  protected readonly pairOptions = computed(() => {
    const current = this.current();
    const paired = new Set(this.rolePairs().map((pair) => pair.other));
    return orderRoles(this.roles.value() ?? [])
      .filter(
        (role) =>
          role.code !== current?.code &&
          !paired.has(role.code) &&
          roleEditLock(role, this.session.roles(), this.session.permissions()) === null,
      )
      .map((role) => ({ value: role.code, label: role.name }));
  });

  protected readonly pairForm = this.fb.nonNullable.group({
    other: ['', [Validators.required]],
    reason: ['', [Validators.required, Validators.maxLength(300)]],
  });
  protected readonly savingPair = signal(false);

  /* ------------------------------------------------------- confirmación -- */

  protected readonly confirming = signal<Pending | null>(null);
  protected readonly confirmPending = signal(false);
  protected readonly confirmText = computed(() => {
    const pending = this.confirming();
    const name = this.current()?.name ?? '';
    switch (pending?.kind) {
      case 'deactivate':
        return {
          heading: `Desactivar ${name}`,
          description:
            'El rol deja de otorgar sus permisos y no se puede asignar. Las cuentas que lo tienen conservan la asignación, pero pierden esos permisos y se cierran sus sesiones. Se puede reactivar.',
          action: 'Desactivar rol',
        };
      case 'reactivate':
        return {
          heading: `Reactivar ${name}`,
          description:
            'Las cuentas que conservan la asignación recuperan los permisos del rol en su siguiente inicio de sesión.',
          action: 'Reactivar rol',
        };
      case 'unpair':
        return {
          heading: `Permitir la combinación con ${this.roleName(pending.other)}`,
          description:
            'Una misma persona podrá volver a tener estos dos roles. Revisa que sus responsabilidades puedan combinarse.',
          action: 'Permitir combinación',
        };
      default:
        return { heading: '', description: '', action: '' };
    }
  });

  constructor() {
    effect(() => {
      const saved = this.savedData();
      this.form.reset(saved);
    });
  }

  protected roleName(code: string): string {
    return displayRoleName(code, this.roles.value() ?? []);
  }

  protected isDelegated(code: string): boolean {
    return this.delegation().includes(code);
  }

  protected toggleDelegation(code: string, checked: boolean): void {
    this.delegation.update((current) =>
      checked ? [...current, code] : current.filter((item) => item !== code),
    );
  }

  protected resetDelegation(): void {
    this.delegation.set(this.savedDelegation());
  }

  protected errorFor(control: 'name' | 'description'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    return null;
  }

  protected async saveData(): Promise<void> {
    const role = this.current();
    this.form.markAllAsTouched();
    if (role === null || this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    await this.run(this.savingData, async () => {
      this.current.set(
        await this.access.updateRole(role.code, {
          name: value.name.trim(),
          description: value.description.trim() || null,
        }),
      );
      this.roles.reload();
      this.toasts.notify('Datos del rol guardados.');
    });
  }

  protected async saveDelegation(): Promise<void> {
    const role = this.current();
    if (role === null) {
      return;
    }
    await this.run(this.savingDelegation, async () => {
      this.current.set(await this.access.replaceAssignableRoles(role.code, this.delegation()));
      this.roles.reload();
      this.toasts.notify('Delegación guardada. Se aplica a la próxima asignación.');
    });
  }

  protected async declarePair(): Promise<void> {
    const role = this.current();
    this.pairForm.markAllAsTouched();
    if (role === null || this.pairForm.invalid) {
      return;
    }
    const value = this.pairForm.getRawValue();
    await this.run(this.savingPair, async () => {
      await this.access.declareIncompatible(role.code, value.other, value.reason.trim());
      this.pairForm.reset();
      this.pairs.reload();
      this.toasts.notify(
        `${role.name} y ${this.roleName(value.other)} ya no se pueden asignar a la misma persona.`,
      );
    });
  }

  protected async confirm(): Promise<void> {
    const pending = this.confirming();
    const role = this.current();
    if (pending === null || role === null) {
      return;
    }
    await this.run(this.confirmPending, async () => {
      if (pending.kind === 'deactivate') {
        this.current.set(await this.access.deactivateRole(role.code));
        this.toasts.notify(`${role.name} quedó inactivo.`);
      } else if (pending.kind === 'reactivate') {
        this.current.set(await this.access.updateRole(role.code, { active: true }));
        this.toasts.notify(`${role.name} vuelve a estar activo.`);
      } else {
        await this.access.removeIncompatibility(role.code, pending.other);
        this.pairs.reload();
        this.toasts.notify('Regla de combinación retirada.');
      }
      this.roles.reload();
    });
    this.confirming.set(null);
  }

  /** Ejecuta una operación con su indicador de espera y deja el fallo a la vista. */
  private async run(flag: WritableSignal<boolean>, work: () => Promise<void>): Promise<void> {
    flag.set(true);
    this.failure.set(null);
    try {
      await work();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      flag.set(false);
    }
  }
}
