import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { formatDate, todayIso } from '../../core/format/format';
import { ACCOUNT_STATUS, SECURITY_LEVEL, label } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { DateField } from '../../shared/date-field';
import { Dialog } from '../../shared/dialog';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { IdentityAccount, Role, SECURITY_LEVELS, SecurityLevel } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { orderRoles } from './access-matrix';
import { accessAreas, accessFailure, rolePurpose, roleName } from './access-presentation';
import {
  ACCOUNT_TONES,
  ASSIGNMENT_STATE,
  accountLock,
  assignmentState,
  assignmentTone,
  manageableRoles,
} from './access-rules';

/**
 * Roles de una cuenta: los que tiene, con su vigencia, y el alta de uno nuevo.
 *
 * Solo se ofrecen los roles que quien asigna tiene delegados, y la hoja entera
 * queda en lectura si la cuenta es la propia o está por encima de la suya: son
 * las reglas con las que el servicio respondería 403. Que un rol sea
 * incompatible con otro de la cuenta solo lo sabe el servicio; su 409 se
 * muestra tal cual, porque nombra el par y el motivo.
 */
@Component({
  selector: 'medsys-account-roles-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'access-feature' },
  imports: [Dialog, ConfirmDialog, Select, DateField, StatusChip, ReactiveFormsModule, Icon],
  templateUrl: './account-roles-sheet.html',
  styleUrl: './access-form.scss',
})
export class AccountRolesSheet {
  readonly account = input<IdentityAccount | null>(null);
  readonly roles = input.required<readonly Role[]>();
  readonly closed = output<void>();
  /** La cuenta cambió en el servicio: la lista debe recargarse. */
  readonly changed = output<void>();

  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly statuses = ACCOUNT_STATUS;
  protected readonly purpose = rolePurpose;
  protected readonly adding = signal(false);
  protected readonly showAuthorization = signal(false);
  protected readonly ownAccount = computed(
    () => this.current()?.publicId === this.session.user()?.publicId,
  );
  protected readonly hasProtectedRoles = computed(() =>
    this.roles().some(
      (role) =>
        role.accessModel === 'MAC' &&
        this.current()?.roles.some(
          (assignment) => assignment.active && assignment.role === role.code,
        ),
    ),
  );
  protected readonly statusTones = ACCOUNT_TONES;
  protected readonly states = ASSIGNMENT_STATE;
  protected readonly tones = assignmentTone;
  protected readonly today = todayIso();

  /** La cuenta tal como la devolvió la última operación. */
  protected readonly current = linkedSignal(() => this.account());

  protected readonly canAssign = computed(() => can.assignRoles(this.session.permissions()));
  protected readonly lock = computed(() => {
    const account = this.current();
    return account === null
      ? null
      : accountLock(
          account,
          this.session.user()?.publicId ?? null,
          this.roles(),
          this.session.permissions(),
        );
  });
  protected readonly editable = computed(() => this.canAssign() && this.lock() === null);

  /**
   * MAC (ISO-01): solo el OSI fija el nivel, nunca el propio ni por encima del
   * suyo. El nivel acota lo que los roles dan: un rol con permisos restringidos
   * no los entrega a una cuenta confidencial.
   */
  protected readonly canSetClearance = computed(
    () =>
      can.manageClearance(this.session.permissions()) &&
      this.current()?.publicId !== this.session.user()?.publicId,
  );
  protected readonly clearanceLabel = computed(() =>
    label(SECURITY_LEVEL, this.current()?.clearance ?? 'INTERNAL'),
  );
  protected readonly clearanceOptions = computed(() => {
    const own = SECURITY_LEVELS.indexOf(
      (this.session.user()?.clearance ?? 'PUBLIC') as SecurityLevel,
    );
    return SECURITY_LEVELS.slice(0, own + 1).map((level) => ({
      value: level,
      label: label(SECURITY_LEVEL, level),
    }));
  });
  protected readonly clearance = linkedSignal<string>(() => this.current()?.clearance ?? '');

  private readonly manageable = computed(() =>
    manageableRoles(this.roles(), this.session.roles(), this.session.permissions()),
  );

  protected readonly assignments = computed(() => {
    const names = new Map(this.roles().map((role) => [role.code, role.name]));
    return [...(this.current()?.roles ?? [])]
      .sort((a, b) => a.role.localeCompare(b.role) || a.validFrom.localeCompare(b.validFrom))
      .map((assignment) => ({
        ...assignment,
        name: names.get(assignment.role) ?? roleName(assignment.role),
        state: assignmentState(assignment, this.today),
        validity: this.validity(assignment.validFrom, assignment.validUntil),
        revocable: this.manageable().has(assignment.role),
      }));
  });

  /**
   * Roles activos que se pueden asignar y que la cuenta no tiene. Uno que tuvo y
   * venció tampoco se ofrece: el servicio lo rechaza por duplicado, y renovarlo
   * es revocar la asignación vencida y crear otra.
   */
  protected readonly roleOptions = computed(() => {
    const held = new Set((this.current()?.roles ?? []).map((assignment) => assignment.role));
    return orderRoles(this.roles())
      .filter((role) => role.active && this.manageable().has(role.code) && !held.has(role.code))
      .map((role) => ({ value: role.code, label: role.name }));
  });

  protected readonly form = this.fb.nonNullable.group({
    role: ['', [Validators.required]],
    validFrom: [this.today, [Validators.required]],
    validUntil: [''],
  });
  private readonly chosenCode = toSignal(this.form.controls.role.valueChanges, {
    initialValue: '',
  });
  protected readonly selectedRole = computed(
    () => this.roles().find((role) => role.code === this.chosenCode()) ?? null,
  );
  protected readonly previewAreas = computed(() =>
    accessAreas(this.selectedRole()?.permissions ?? []).map((area) => area.name),
  );
  protected readonly needsAuthorization = computed(() => {
    const role = this.selectedRole();
    const level = SECURITY_LEVELS.indexOf(this.current()?.clearance ?? 'INTERNAL');
    return (
      role?.accessModel === 'MAC' &&
      role.permissions.some(
        (permission) => SECURITY_LEVELS.indexOf(permission.classification) > level,
      )
    );
  });
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : accessFailure(failure, this.roles());
  });
  protected readonly datesError = signal<string | null>(null);

  protected readonly revoking = signal<{ readonly role: string; readonly name: string } | null>(
    null,
  );

  constructor() {
    effect(() => {
      if (this.account() !== null) {
        this.form.reset({ role: '', validFrom: this.today, validUntil: '' });
        this.failure.set(null);
        this.datesError.set(null);
        this.adding.set(false);
        this.showAuthorization.set(false);
      }
    });
  }

  protected heading(): string {
    return this.current()?.fullName ?? 'Cuenta';
  }

  private validity(from: string, until: string | null): string {
    return until === null
      ? `Desde ${formatDate(from)}, sin fecha de fin`
      : `Del ${formatDate(from)} al ${formatDate(until)}`;
  }

  protected async assign(): Promise<void> {
    const account = this.current();
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    this.datesError.set(
      value.validUntil !== '' && value.validUntil < value.validFrom
        ? 'La fecha de fin no puede ser anterior a la de inicio'
        : null,
    );
    if (account === null || this.form.invalid || this.datesError() !== null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      this.current.set(
        await this.access.assignRole(account.publicId, {
          role: value.role,
          validFrom: value.validFrom,
          validUntil: value.validUntil || null,
        }),
      );
      this.toasts.notify(
        `${account.fullName} recibió el rol ${roleName(value.role, this.roles())}.`,
      );
      this.form.reset({ role: '', validFrom: this.today, validUntil: '' });
      this.adding.set(false);
      this.changed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async setClearance(): Promise<void> {
    const account = this.current();
    const level = this.clearance() as SecurityLevel;
    if (account === null || level === account.clearance) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      this.current.set(await this.access.changeClearance(account.publicId, level, null));
      this.toasts.notify(`${account.fullName} quedó con nivel ${label(SECURITY_LEVEL, level)}.`);
      this.changed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async revoke(): Promise<void> {
    const account = this.current();
    const target = this.revoking();
    if (account === null || target === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      this.current.set(await this.access.revokeRole(account.publicId, target.role));
      this.toasts.notify(`${account.fullName} ya no tiene el rol ${target.name}.`);
      this.changed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
      this.revoking.set(null);
    }
  }
}
