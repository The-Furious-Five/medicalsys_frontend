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
import { Icon } from '../../core/ui/icon';
import { Notice } from '../../shared/notice';

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

/**
 * Jerarquía: el formulario manda y ocupa la columna izquierda, sobre superficie
 * blanca; la marca y la naturaleza del entorno viven a la derecha, en una
 * superficie neutra que nunca compite con el campo de contraseña.
 */
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
  protected readonly email = signal('');
  protected readonly password = signal('');
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

  /** Rellena el formulario, pero no entra: pulsar «Entrar» sigue siendo del usuario. */
  protected useDemoAccount(account: DemoAccount): void {
    this.email.set(account.email);
    this.password.set(DEMO_PASSWORD);
    this.error.set(null);
    this.emailField()?.nativeElement.focus();
  }
}
