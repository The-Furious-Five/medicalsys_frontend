import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '../core/ui/icon';

/**
 * Capa modal sobre el elemento `<dialog>` nativo.
 *
 * Se usa el elemento del navegador y no una superposición propia porque aporta
 * de fábrica lo que cuesta acertar a mano: trampa de foco, cierre con `Esc`,
 * fondo inerte y devolución del foco al elemento que la abrió. La animación es
 * CSS, declarada junto al resto del sistema de diseño.
 *
 * `variant='sheet'` es la hoja lateral: se usa cuando el contexto de detrás
 * debe seguir visible mientras se rellena el formulario.
 */
@Component({
  selector: 'medsys-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <dialog
      #layer
      class="layer"
      [class.is-dialog]="variant() === 'dialog'"
      [class.is-sheet]="variant() === 'sheet'"
      [attr.aria-label]="heading()"
      (close)="closed.emit()"
      (click)="onBackdropClick($event)"
    >
      <div [class]="variant()" [style.width]="widthPx()">
        <div class="dialog-head">
          <div class="row gap-3">
            <div class="grow">
              <h2 class="t-section">{{ heading() }}</h2>
              @if (description()) {
                <p class="t-sec" style="margin-top: 4px">{{ description() }}</p>
              }
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-icon"
              aria-label="Cerrar"
              (click)="close()"
            >
              <medsys-icon name="x" [size]="16" />
            </button>
          </div>
        </div>

        <div class="dialog-body" [class.grow]="variant() === 'sheet'">
          <ng-content />
        </div>

        <div class="dialog-foot">
          <ng-content select="[dialogFooter]" />
        </div>
      </div>
    </dialog>
  `,
})
export class Dialog {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  readonly variant = input<'dialog' | 'sheet'>('dialog');
  readonly width = input<number | null>(null);

  readonly closed = output<void>();

  private readonly layer = viewChild.required<ElementRef<HTMLDialogElement>>('layer');

  constructor() {
    effect(() => {
      const element = this.layer().nativeElement;
      if (this.open() && !element.open) {
        element.showModal();
      } else if (!this.open() && element.open) {
        element.close();
      }
    });
  }

  protected widthPx(): string | null {
    const width = this.width();
    if (width === null) {
      return null;
    }
    return this.variant() === 'sheet'
      ? `min(${width}px, 100vw)`
      : `min(${width}px, calc(100vw - 32px))`;
  }

  protected close(): void {
    this.layer().nativeElement.close();
  }

  /** Un clic en el fondo cierra la capa: el evento apunta al propio `<dialog>`
   *  cuando cae fuera del panel, porque el panel es un hijo. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.layer().nativeElement) {
      this.close();
    }
  }
}
