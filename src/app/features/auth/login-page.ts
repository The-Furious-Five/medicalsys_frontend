import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MfaChallenge, MfaEnrollment } from '../../core/auth/authenticated-user';
import { AuthService } from '../../core/auth/auth.service';
import { describeFailure } from '../../core/http/api-error';
import { Icon, IconName } from '../../core/ui/icon';
import { Notice } from '../../shared/notice';
import { POLICY_SERVER_RULES, meetsPolicy, passwordRules } from './password-policy';

interface BrandPoint {
  readonly icon: IconName;
  readonly label: string;
  readonly description: string;
}

/** Tres frases, no diez: lo que la plataforma hace, dicho en verbos concretos. */
const BRAND_POINTS: readonly BrandPoint[] = [
  {
    icon: 'clipboard-list',
    label: 'Historias que acompañan',
    description: 'La información clínica de cada paciente, reunida.',
  },
  {
    icon: 'calendar',
    label: 'Un equipo en sintonía',
    description: 'Citas y profesionales en una agenda compartida.',
  },
  {
    icon: 'receipt',
    label: 'Una gestión más simple',
    description: 'Prestaciones y facturación, sin duplicar datos.',
  },
];

/**
 * - `login`: usuario y contraseña.
 * - `change`: la contraseña es temporal o venció (IAM-05).
 * - `enroll`: primer ingreso, registro del QR en la aplicación autenticadora (IAM-07).
 * - `verify`: código de 6 dígitos de la aplicación.
 */
type Step = 'login' | 'change' | 'enroll' | 'verify';

const CODE_LENGTH = 6;

/**
 * Acceso con usuario, contraseña y segundo factor TOTP obligatorio. No ofrece cuentas de ejemplo ni
 * contraseñas: la pantalla es la misma que en producción. Quien no tiene acceso lo pide al
 * administrador de su centro, que le entrega su usuario y una contraseña temporal.
 */
@Component({
  selector: 'medsys-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgTemplateOutlet, Icon, Notice],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  protected readonly brandPoints = BRAND_POINTS;
  protected readonly codeLength = CODE_LENGTH;
  protected readonly step = signal<Step>('login');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly locked = signal(false);
  protected readonly pending = signal(false);

  protected readonly newPassword = signal('');
  protected readonly confirmation = signal('');
  protected readonly serverRules = POLICY_SERVER_RULES;
  protected readonly rules = computed(() => passwordRules(this.newPassword(), this.username()));
  protected readonly mismatch = computed(
    () => this.confirmation().length > 0 && this.confirmation() !== this.newPassword(),
  );

  /** Desafío del segundo factor: token opaco de un solo uso, vence a los pocos minutos. */
  private mfaToken: string | null = null;
  protected readonly enrollment = signal<MfaEnrollment | null>(null);
  protected readonly code = signal('');
  protected readonly secretCopied = signal(false);

  private readonly usernameField = viewChild<ElementRef<HTMLInputElement>>('usernameField');
  private readonly newPasswordField = viewChild<ElementRef<HTMLInputElement>>('newPasswordField');
  private readonly codeField = viewChild<ElementRef<HTMLInputElement>>('codeField');

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.locked.set(false);
    if (!this.username().trim() || !this.password()) {
      // Se valida aquí: un envío vacío solo devolvería el mensaje técnico de validación del servicio.
      this.error.set('Ingresa tu usuario y tu contraseña.');
      return;
    }
    this.pending.set(true);
    try {
      await this.continueWith(await this.auth.login(this.username().trim(), this.password()));
    } catch (failure) {
      const detail = describeFailure(failure);
      this.pending.set(false);
      if (detail.code === 'PASSWORD_CHANGE_REQUIRED') {
        this.newPassword.set('');
        this.confirmation.set('');
        this.goTo('change', () => this.newPasswordField()?.nativeElement.focus());
        return;
      }
      this.locked.set(detail.status === 423);
      this.error.set(detail.message);
    }
  }

  protected async submitChange(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (!meetsPolicy(this.newPassword(), this.username())) {
      this.error.set('La nueva contraseña todavía no cumple todas las reglas de la lista.');
      return;
    }
    if (this.newPassword() !== this.confirmation()) {
      this.error.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    this.pending.set(true);
    try {
      await this.auth.changeExpiredPassword(
        this.username().trim(),
        this.password(),
        this.newPassword(),
      );
      // La temporal ya no sirve: el resto del ingreso sigue con la nueva.
      this.password.set(this.newPassword());
      await this.continueWith(await this.auth.login(this.username().trim(), this.newPassword()));
    } catch (failure) {
      this.error.set(describeFailure(failure).message);
      this.pending.set(false);
    }
  }

  /** Solo dígitos, como máximo seis: así se puede pegar el código con espacios. */
  protected onCodeInput(value: string): void {
    this.code.set(value.replace(/\D/g, '').slice(0, CODE_LENGTH));
  }

  protected async submitCode(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (this.code().length !== CODE_LENGTH || this.mfaToken === null) {
      this.error.set('Escribe los 6 dígitos que muestra tu aplicación autenticadora.');
      return;
    }
    this.pending.set(true);
    try {
      if (this.step() === 'enroll') {
        await this.auth.activateMfa(this.mfaToken, this.code());
      } else {
        await this.auth.verifyMfa(this.mfaToken, this.code());
      }
      this.mfaToken = null;
      // Se recupera la ruta que el usuario intentaba abrir antes del acceso.
      const destination = this.route.snapshot.queryParamMap.get('destino') ?? '/';
      await this.router.navigateByUrl(destination);
    } catch (failure) {
      const detail = describeFailure(failure);
      this.pending.set(false);
      this.code.set('');
      if (detail.code === 'MFA_CHALLENGE_EXPIRED' || detail.status === 423) {
        this.backToLogin();
        this.locked.set(detail.status === 423);
        this.error.set(detail.message);
        return;
      }
      this.error.set(detail.message);
      this.codeField()?.nativeElement.focus();
    }
  }

  protected async copySecret(secret: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s/g, ''));
      this.secretCopied.set(true);
    } catch {
      // Sin permiso de portapapeles queda el texto seleccionable.
      this.secretCopied.set(false);
    }
  }

  protected backToLogin(): void {
    this.mfaToken = null;
    this.enrollment.set(null);
    this.code.set('');
    this.password.set('');
    this.newPassword.set('');
    this.confirmation.set('');
    this.error.set(null);
    this.locked.set(false);
    this.pending.set(false);
    this.goTo('login', () => this.usernameField()?.nativeElement.focus());
  }

  /** Contraseña aceptada: falta registrar el QR o escribir el código. */
  private async continueWith(challenge: MfaChallenge): Promise<void> {
    this.mfaToken = challenge.mfaToken;
    this.username.set(challenge.username);
    this.code.set('');
    if (challenge.status === 'MFA_ENROLLMENT_REQUIRED') {
      this.enrollment.set(await this.auth.startMfaEnrollment(challenge.mfaToken));
      this.secretCopied.set(false);
      this.goTo('enroll', () => this.codeField()?.nativeElement.focus());
    } else {
      this.goTo('verify', () => this.codeField()?.nativeElement.focus());
    }
    this.pending.set(false);
  }

  /** El paso nuevo recién se dibuja en el próximo render: el foco espera a ese momento. */
  private goTo(step: Step, focus: () => void): void {
    this.step.set(step);
    afterNextRender(focus, { injector: this.injector });
  }
}
