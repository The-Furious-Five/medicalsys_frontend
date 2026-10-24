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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { describeFailure } from '../../core/http/api-error';
import { Icon, IconName } from '../../core/ui/icon';
import { Notice } from '../../shared/notice';
import { POLICY_SERVER_RULES, meetsPolicy, passwordRules } from './password-policy';

interface DemoAccount {
  readonly email: string;
  readonly role: string;
}

/** Una por rol (ISO-01): cada una ve solo los módulos que sus permisos alcanzan. */
const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: 'osi@medicalsys.demo', role: 'Oficial de Seguridad (OSI)' },
  { email: 'admin@medicalsys.demo', role: 'Administración del centro' },
  { email: 'doctor@medicalsys.demo', role: 'Profesional de salud' },
  { email: 'enfermeria@medicalsys.demo', role: 'Enfermería' },
  { email: 'laboratorio@medicalsys.demo', role: 'Laboratorio' },
  { email: 'recepcion@medicalsys.demo', role: 'Recepción' },
  { email: 'caja@medicalsys.demo', role: 'Facturación' },
  { email: 'marketing@medicalsys.demo', role: 'Marketing' },
  { email: 'auditor@medicalsys.demo', role: 'Auditoría interna' },
];
// La contraseña de las cuentas demo NO va en el código: este archivo viaja completo al navegador y
// cualquiera podría leerla. Se entrega aparte (IDENTITY_DEMO_PASSWORD del backend).

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

/** Acceso centrado con presentación de marca y formulario adaptable a móvil. */
@Component({
  selector: 'medsys-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, Notice],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly brandPoints = BRAND_POINTS;
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly locked = signal(false);
  protected readonly pending = signal(false);

  /**
   * Primer ingreso con contraseña temporal o contraseña vencida (IAM-05): el servicio responde
   * PASSWORD_CHANGE_REQUIRED y, en vez de un error, se pide la nueva aquí mismo.
   */
  protected readonly mode = signal<'login' | 'change'>('login');
  protected readonly newPassword = signal('');
  protected readonly confirmation = signal('');
  protected readonly serverRules = POLICY_SERVER_RULES;
  protected readonly rules = computed(() => passwordRules(this.newPassword(), this.email()));
  protected readonly mismatch = computed(
    () => this.confirmation().length > 0 && this.confirmation() !== this.newPassword(),
  );

  private readonly emailField = viewChild<ElementRef<HTMLInputElement>>('emailField');
  private readonly passwordField = viewChild<ElementRef<HTMLInputElement>>('passwordField');
  private readonly newPasswordField = viewChild<ElementRef<HTMLInputElement>>('newPasswordField');

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (!this.email().trim() || !this.password()) {
      // Se valida aquí: un envío vacío solo devolvería el mensaje técnico de validación del servicio.
      this.error.set('Ingresa tu correo y tu contraseña.');
      return;
    }
    this.pending.set(true);
    try {
      await this.auth.login(this.email().trim(), this.password());
      // Se recupera la ruta que el usuario intentaba abrir antes del acceso.
      const destination = this.route.snapshot.queryParamMap.get('destino') ?? '/';
      await this.router.navigateByUrl(destination);
    } catch (failure) {
      const detail = describeFailure(failure);
      this.pending.set(false);
      if (detail.code === 'PASSWORD_CHANGE_REQUIRED') {
        this.mode.set('change');
        this.newPassword.set('');
        this.confirmation.set('');
        // El formulario de cambio recién se dibuja en el próximo render: el foco espera a ese momento.
        afterNextRender(() => this.newPasswordField()?.nativeElement.focus(), {
          injector: this.injector,
        });
        return;
      }
      this.locked.set(detail.status === 423);
      this.error.set(detail.message);
    }
  }

  protected async submitChange(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (!meetsPolicy(this.newPassword(), this.email())) {
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
        this.email().trim(),
        this.password(),
        this.newPassword(),
      );
      await this.auth.login(this.email().trim(), this.newPassword());
      const destination = this.route.snapshot.queryParamMap.get('destino') ?? '/';
      await this.router.navigateByUrl(destination);
    } catch (failure) {
      this.error.set(describeFailure(failure).message);
      this.pending.set(false);
    }
  }

  protected backToLogin(): void {
    this.mode.set('login');
    this.password.set('');
    this.error.set(null);
  }

  /** Completa el correo de la cuenta demo; la contraseña la escribe la persona. */
  protected useDemoAccount(account: DemoAccount): void {
    this.email.set(account.email);
    this.password.set('');
    this.error.set(null);
    this.locked.set(false);
    this.passwordField()?.nativeElement.focus();
  }
}
