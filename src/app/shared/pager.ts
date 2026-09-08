import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Paginación del servidor. Solo aparece cuando hay más de una página. */
@Component({
  selector: 'medsys-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <div class="pager">
        <span class="t-sec t-num">Página {{ page() + 1 }} de {{ totalPages() }}</span>
        <div class="row gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            [disabled]="page() === 0"
            (click)="pageChange.emit(page() - 1)"
          >
            Anterior
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            [disabled]="page() + 1 >= totalPages()"
            (click)="pageChange.emit(page() + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
}
