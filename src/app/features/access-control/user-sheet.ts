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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { todayIso } from '../../core/format/format';
import { describeFailure } from '../../core/http/api-error';
import { ACCOUNT_STATUS } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { IdentityAccount, Role } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { orderRoles } from './access-matrix';
import { ACCOUNT_TONES, accountManagementLock, manageableRoles } from './access-rules';
import { IssuedPassword } from './temporary-password-dialog';

type PendingAction = 'unlock' | 'reset' | 'deactivate' | 'reactivate';

const E164 = /^\+[1-9][0-9]{6,18}$/;

/** Frase común a desbloqueo y reinicio: la decisión del kickoff exige verificar a la persona. */
const VERIFY_IDENTITY =
  'Antes de continuar, verifica la identidad de la persona por un canal distinto al sistema (en persona o por llamada): así nadie se hace pasar por ella.';

const CONFIRMATIONS: Record<
  PendingAction,
  { heading: string; description: string; label: string; danger: boolean }
> = {
  unlock: {
    heading: 'Desbloquear la cuenta',
    description: `La cuenta se bloqueó por 3 intentos fallidos y no se desbloquea sola. ${VERIFY_IDENTITY}`,
    label: 'Ya verifiqué, desbloquear',
    danger: false,
  },
  reset: {
    heading: 'Reiniciar la contraseña',
    description: `Se emite una contraseña temporal de un solo uso y se cierran las sesiones abiertas. La persona deberá definir la suya al entrar. ${VERIFY_IDENTITY}`,
    label: 'Ya verifiqué, reiniciar',
    danger: true,
  },
  deactivate: {
    heading: 'Dar de baja la cuenta',
    description:
      'La cuenta no se borra: queda deshabilitada, su User ID no se reutiliza y sus acciones siguen identificadas en la bitácora. Se cierran sus sesiones.',
    label: 'Dar de baja',
    danger: true,
  },
  reactivate: {
    heading: 'Reactivar la cuenta',
    description: 'La cuenta vuelve a poder iniciar sesión con su contraseña actual.',
    label: 'Reactivar',
    danger: false,
  },
};

/**
 * Alta, edición y acciones de una cuenta (IAM-06).
 *
 * Todo pasa por ms-identidad, que sincroniza Keycloak: la pantalla nunca toca la base ni la consola
 * de Keycloak. El alta no pide contraseña: el servicio genera una temporal de un solo uso y la
 * entrega una vez. Las reglas de gobierno se anticipan para no ofrecer lo imposible; si algo se
 * escapa, se muestra el mensaje del servicio.
 */
@Component({
  selector: 'medsys-user-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, ConfirmDialog, Notice, Select, StatusChip, ReactiveFormsModule, Icon],
  templateUrl: './user-sheet.html',
})
export class UserSheet {
  /** La cuenta a editar; con `creating` en true la hoja es un alta. */
  readonly account = input<IdentityAccount | null>(null);
  readonly creating = input(false);
  readonly roles = input.required<readonly Role[]>();
  readonly closed = output<void>();
  /** La cuenta cambió en el servicio: la lista debe recargarse. */
  readonly changed = output<void>();
  /** Se emitió una contraseña temporal: la página la muestra una sola vez. */
  readonly issued = output<IssuedPassword>();

  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly statuses = ACCOUNT_STATUS;
  protected readonly statusTones = ACCOUNT_TONES;
  protected readonly confirmations = CONFIRMATIONS;

  protected readonly current = linkedSignal(() => this.account());
  protected readonly open = computed(() => this.creating() || this.account() !== null);

  private readonly granted = computed(() => this.session.permissions());
  protected readonly canUpdate = computed(() => can.updateUsers(this.granted()));
  protected readonly canChangeStatus = computed(() => can.changeUserStatus(this.granted()));
  protected readonly canUnlock = computed(() => can.unlockUsers(this.granted()));
  protected readonly canReset = computed(() => can.resetPasswords(this.granted()));

  protected readonly own = computed(
    () => this.current()?.publicId === (this.session.user()?.publicId ?? null),
  );
  protected readonly lock = computed(() => {
    const account = this.current();
    return account === null ? null : accountManagementLock(account, this.roles(), this.granted());
  });

  /** Rol inicial del alta: los activos que quien da de alta tiene delegados. */
  protected readonly roleOptions = computed(() => {
    const manageable = manageableRoles(this.roles(), this.session.roles(), this.granted());
    return orderRoles(this.roles())
      .filter((role) => role.active && manageable.has(role.code))
      .map((role) => ({ value: role.code, label: `${role.name} · ${role.code}` }));
  });

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(180)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phoneE164: ['', [Validators.pattern(E164)]],
    role: [''],
    activate: [true],
  });

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });
  protected readonly confirming = signal<PendingAction | null>(null);

  constructor() {
    effect(() => {
      if (this.open()) {
        const account = this.account();
        this.form.reset({
          fullName: account?.fullName ?? '',
          email: account?.email ?? '',
          phoneE164: account?.phoneE164 ?? '',
          role: '',
          activate: true,
        });
        this.failure.set(null);
        this.confirming.set(null);
      }
    });
  }

  protected heading(): string {
    return this.creating() ? 'Nueva cuenta' : (this.current()?.fullName ?? 'Cuenta');
  }

  protected fieldError(name: 'fullName' | 'email' | 'phoneE164'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Este dato es obligatorio';
    }
    if (control.hasError('email')) {
      return 'Escribe un correo válido, como nombre@centro.med';
    }
    if (control.hasError('pattern')) {
      return 'Usa el formato internacional, por ejemplo +59171234567';
    }
    return 'Es demasiado largo';
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const phone = value.phoneE164.trim() === '' ? null : value.phoneE164.trim();
    this.pending.set(true);
    this.failure.set(null);
    try {
      if (this.creating()) {
        const created = await this.access.createAccount({
          email: value.email.trim(),
          fullName: value.fullName.trim(),
          phoneE164: phone,
          activateImmediately: value.activate,
          roles: value.role ? [{ role: value.role, validFrom: todayIso(), validUntil: null }] : [],
        });
        this.changed.emit();
        this.closed.emit();
        if (created.temporaryPassword) {
          this.issued.emit({
            fullName: created.fullName,
            userCode: created.userCode,
            password: created.temporaryPassword,
            reason: 'alta',
          });
        }
      } else {
        const account = this.current();
        if (account === null) {
          return;
        }
        this.current.set(
          await this.access.updateAccount(account.publicId, {
            fullName: value.fullName.trim(),
            email: value.email.trim(),
            phoneE164: phone,
          }),
        );
        this.toasts.notify(`Se guardaron los datos de ${value.fullName.trim()}.`);
        this.changed.emit();
      }
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async run(action: PendingAction): Promise<void> {
    const account = this.current();
    if (account === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      switch (action) {
        case 'unlock':
          this.current.set(await this.access.unlock(account.publicId));
          this.toasts.notify(`${account.fullName} ya puede volver a iniciar sesión.`);
          break;
        case 'reset': {
          const issued = await this.access.resetPassword(account.publicId);
          this.issued.emit({
            fullName: account.fullName,
            userCode: issued.userCode,
            password: issued.temporaryPassword,
            reason: 'reinicio',
          });
          break;
        }
        case 'deactivate':
          this.current.set(
            await this.access.changeStatus(
              account.publicId,
              'INACTIVE',
              'Baja desde gestión de usuarios',
            ),
          );
          this.toasts.notify(`${account.fullName} quedó dada de baja.`);
          break;
        case 'reactivate':
          this.current.set(
            await this.access.changeStatus(
              account.publicId,
              'ACTIVE',
              'Reactivación desde gestión de usuarios',
            ),
          );
          this.toasts.notify(`${account.fullName} quedó reactivada.`);
          break;
      }
      this.changed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
      this.confirming.set(null);
    }
  }
}
