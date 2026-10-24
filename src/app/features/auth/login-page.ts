import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
/** `IDENTITY_DEMO_PASSWORD` por defecto de ms-identidad. */
const DEMO_PASSWORD = 'SanGabriel.Demo26!';

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

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly brandPoints = BRAND_POINTS;
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(false);

  private readonly emailField = viewChild<ElementRef<HTMLInputElement>>('emailField');

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
      this.error.set(describeFailure(failure).message);
      this.pending.set(false);
    }
  }

  /** Rellena el formulario; el usuario confirma el inicio de sesión. */
  protected useDemoAccount(account: DemoAccount): void {
    this.email.set(account.email);
    this.password.set(DEMO_PASSWORD);
    this.error.set(null);
    this.emailField()?.nativeElement.focus();
  }
}
