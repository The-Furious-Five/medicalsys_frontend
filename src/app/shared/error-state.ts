import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { describeFailure } from '../core/http/api-error';
import { Icon } from '../core/ui/icon';
import { IconNamePipe } from '../core/ui/icon-name.pipe';

/**
 * Estado de error. Distingue el motivo real y dice qué puede hacer el usuario.
 * Nunca imprime un JSON crudo ni un rastro de pila.
 */
@Component({
  selector: 'medsys-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconNamePipe],
  template: `
    <div [class]="compact() ? 'error-inline' : 'state'">
      <span class="state-icon" style="color: var(--err-500)">
        <medsys-icon [name]="detail().icon | msIcon" [size]="20" />
      </span>
      <div class="stack gap-1" [style.align-items]="compact() ? 'flex-start' : 'center'">
        <p class="state-title">{{ detail().title }}</p>
        <p class="state-text">{{ detail().message }}</p>
      </div>
      <div class="row gap-2 wrap" [style.justify-content]="compact() ? 'flex-start' : 'center'">
        @if (detail().retryable) {
          <button type="button" class="btn btn-secondary" (click)="retry.emit()">
            <medsys-icon name="refresh" [size]="14" /> Reintentar
          </button>
        }
        @if (detail().correlationId) {
          <button type="button" class="btn btn-ghost btn-sm" (click)="copyDetails()">
            <medsys-icon name="copy" [size]="13" />
            {{ copied() ? 'Copiado' : 'Copiar detalles' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class ErrorState {
  readonly failure = input.required<unknown>();
  readonly compact = input(false);

  readonly retry = output<void>();

  protected readonly copied = signal(false);
  protected readonly detail = computed(() => describeFailure(this.failure()));

  /**
   * Copia un resumen del problema para pegarlo en un correo a soporte.
   *
   * En pantalla no queda ningún dato técnico —un hexadecimal suelto no le dice
   * nada a quien atiende—, pero la referencia sigue existiendo: es lo que
   * permite encontrar el caso exacto en los registros del servidor.
   */
  protected copyDetails(): void {
    const detail = this.detail();
    const summary = [
      detail.title,
      detail.message,
      `Referencia: ${detail.correlationId}`,
      `Fecha: ${new Date().toLocaleString('es-BO')}`,
    ].join('\n');

    void navigator.clipboard?.writeText(summary).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1600);
      },
      () => undefined,
    );
  }
}
