import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
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
    <!-- El clic solo detecta el fondo para cerrar; con teclado, el dialog nativo cierra con Escape. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
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

        <!-- El pie solo existe si alguien lo llena. Sin esto, una capa sin acciones
             -como el buscador global- dibujaba una franja gris vacía al final. -->
        <div class="dialog-foot" [class.is-empty]="footerEmpty()">
          <div #footer style="display: contents">
            <ng-content select="[dialogFooter]" />
          </div>
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
  /**
   * Se emite al abrir, con el propio `<dialog>`.
   *
   * Lo necesita quien tenga que colocar el foco en un campo concreto o escuchar
   * el teclado de toda la capa: `showModal()` enfoca el primer elemento
   * enfocable, que aquí es el botón de cerrar, y los eventos de teclado nacen
   * donde esté el foco, no en el contenido proyectado.
   */
  readonly opened = output<HTMLDialogElement>();

  private readonly layer = viewChild.required<ElementRef<HTMLDialogElement>>('layer');
  private readonly footer = viewChild<ElementRef<HTMLElement>>('footer');
  protected readonly footerEmpty = signal(true);

  constructor() {
    effect(() => {
      const element = this.layer().nativeElement;
      if (this.open() && !element.open) {
        element.showModal();
        this.footerEmpty.set((this.footer()?.nativeElement.childElementCount ?? 0) === 0);
        this.opened.emit(element);
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
