import { Directive, ElementRef, inject, input, signal } from '@angular/core';

/**
 * Descripción emergente propia.
 *
 * El atributo `title` lo dibuja el navegador: aparece con casi un segundo de
 * retraso, no se puede dar estilo, no sale con el foco del teclado y en móvil no
 * sale nunca. Como en la barra contraída es la única forma de saber a dónde
 * lleva cada icono, no puede depender de eso.
 */
@Directive({
  selector: '[medsysTooltip]',
  host: {
    '(pointerenter)': 'show()',
    '(pointerleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(click)': 'hide()',
  },
})
export class Tooltip {
  readonly medsysTooltip = input<string | null | undefined>('');
  readonly tooltipSide = input<'right' | 'top'>('right');

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly visible = signal(false);
  private bubble: HTMLElement | null = null;

  protected show(): void {
    const text = this.medsysTooltip();
    if (!text || this.visible()) {
      return;
    }
    this.visible.set(true);

    // Se monta en el cuerpo del documento: dentro de la barra lateral quedaría
    // recortado por el desplazamiento del propio menú.
    const bubble = document.createElement('div');
    bubble.className = 'ms-tip';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = text;
    document.body.appendChild(bubble);

    const anchor = this.host.nativeElement.getBoundingClientRect();
    const size = bubble.getBoundingClientRect();
    if (this.tooltipSide() === 'right') {
      bubble.style.left = `${anchor.right + 8}px`;
      bubble.style.top = `${anchor.top + anchor.height / 2 - size.height / 2}px`;
    } else {
      bubble.style.left = `${anchor.left + anchor.width / 2 - size.width / 2}px`;
      bubble.style.top = `${anchor.top - size.height - 8}px`;
    }
    this.bubble = bubble;
  }

  protected hide(): void {
    this.visible.set(false);
    this.bubble?.remove();
    this.bubble = null;
  }
}
