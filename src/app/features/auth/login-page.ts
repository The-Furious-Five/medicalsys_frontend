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

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: 'admin@medicalsys.demo', role: 'Administración' },
  { email: 'doctor@medicalsys.demo', role: 'Profesional de salud' },
  { email: 'recepcion@medicalsys.demo', role: 'Recepción' },
];
const DEMO_PASSWORD = 'Demo1234!';

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
  private readonly newPasswordField = viewChild<ElementRef<HTMLInputElement>>('newPasswordField');

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set(null);
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

  /** Rellena el formulario; el usuario confirma el inicio de sesión. */
  protected useDemoAccount(account: DemoAccount): void {
    this.email.set(account.email);
    this.password.set(DEMO_PASSWORD);
    this.error.set(null);
    this.locked.set(false);
    this.emailField()?.nativeElement.focus();
  }
}
