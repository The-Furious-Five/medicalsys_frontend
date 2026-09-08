import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialog } from './dialog';

/**
 * Confirmación de una acción con consecuencias.
 *
 * Nombra el objeto concreto, describe la consecuencia real y el botón lleva el
 * verbo de la acción — «Anular encuentro» — nunca «Aceptar»: quien confirma
 * debe poder leer qué está a punto de pasar sin reconstruirlo de memoria.
 */
@Component({
  selector: 'medsys-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog],
  template: `
    <medsys-dialog [open]="open()" [heading]="heading()" [width]="460" (closed)="cancelled.emit()">
      <div class="stack gap-3">
        <p class="t-body t-measure">{{ description() }}</p>
        <ng-content />
      </div>

      <ng-container dialogFooter>
        <button type="button" class="btn btn-secondary" (click)="cancelled.emit()">Cancelar</button>
        <button
          type="button"
          class="btn"
          [class.btn-danger]="danger()"
          [class.btn-primary]="!danger()"
          [disabled]="pending()"
          (click)="confirmed.emit()"
        >
          {{ confirmLabel() }}
        </button>
      </ng-container>
    </medsys-dialog>
  `,
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly danger = input(true);
  readonly pending = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
