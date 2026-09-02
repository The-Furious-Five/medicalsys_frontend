import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Marca de carga con la forma real del contenido que va a llegar. */
@Component({
  selector: 'medsys-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="skeleton"
    [style.width]="width()"
    [style.height]="height()"
    aria-hidden="true"
  ></span>`,
  styles: `
    :host {
      display: block;
    }
    .skeleton {
      display: block;
    }
  `,
})
export class Skeleton {
  readonly width = input<string>('100%');
  readonly height = input<string>('12px');
}
