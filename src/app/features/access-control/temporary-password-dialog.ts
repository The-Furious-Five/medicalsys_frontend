import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Icon } from '../../core/ui/icon';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';

/** Contraseña temporal recién emitida por el alta o por un reinicio (IAM-04/IAM-05). */
export interface IssuedPassword {
  readonly fullName: string;
  readonly userCode: string;
  readonly password: string;
  readonly reason: 'alta' | 'reinicio';
}

/**
 * Muestra la contraseña temporal una sola vez. El servicio no la guarda y no la vuelve a entregar:
 * al cerrar este diálogo solo queda emitir otra con un reinicio. Quien administra nunca conoce la
 * contraseña definitiva, porque la temporal sirve para un único ingreso y obliga a cambiarla.
 */
@Component({
  selector: 'medsys-temporary-password-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Notice, Icon],
  template: `
    <medsys-dialog
      [open]="issued() !== null"
      [heading]="issued()?.reason === 'alta' ? 'Cuenta creada' : 'Contraseña reiniciada'"
      [description]="issued() ? issued()!.fullName + ' · ' + issued()!.userCode : null"
      (closed)="close()"
    >
      @if (issued(); as item) {
        <div class="stack gap-4">
          <div class="stack gap-2">
            <span class="field-label" id="temporary-label">Contraseña temporal</span>
            <div class="row gap-2">
              <code class="temporary" aria-labelledby="temporary-label">{{ item.password }}</code>
              <button type="button" class="btn btn-secondary btn-sm" (click)="copy(item.password)">
                <medsys-icon [name]="copied() ? 'check' : 'copy'" [size]="14" />
                {{ copied() ? 'Copiada' : 'Copiar' }}
              </button>
            </div>
          </div>
          <medsys-notice tone="warn" icon="shield-alert" heading="Se muestra una sola vez">
            Entrégala por un canal seguro (en persona o por llamada), nunca por chat grupal ni por
            correo masivo. Sirve para un único ingreso: al entrar, el sistema le pedirá a la persona
            que defina su propia contraseña.
          </medsys-notice>
          <div class="row gap-2">
            <span class="grow"></span>
            <button type="button" class="btn btn-primary btn-sm" (click)="close()">
              Ya la entregué
            </button>
          </div>
        </div>
      }
    </medsys-dialog>
  `,
  styles: `
    .temporary {
      font-family: var(--font-mono);
      font-size: 1.125rem;
      letter-spacing: 0.04em;
      padding: var(--s-2) var(--s-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--r-input);
      user-select: all;
    }
  `,
})
export class TemporaryPasswordDialog {
  readonly issued = input<IssuedPassword | null>(null);
  readonly closed = output<void>();

  protected readonly copied = signal(false);

  protected async copy(password: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(password);
      this.copied.set(true);
    } catch {
      // Sin permiso de portapapeles queda el texto seleccionable (user-select: all).
      this.copied.set(false);
    }
  }

  protected close(): void {
    this.copied.set(false);
    this.closed.emit();
  }
}
