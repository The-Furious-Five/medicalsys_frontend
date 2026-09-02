import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../core/ui/icon';

export interface Crumb {
  readonly label: string;
  readonly link?: string;
}

/**
 * Cabecera de vista. Una sola acción primaria visible; el resto, secundarias.
 * La miga de pan aparece solo cuando hay un nivel superior real al que volver.
 */
@Component({
  selector: 'medsys-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <header class="page-header">
      @if (crumbs().length > 0) {
        <nav aria-label="Ruta de navegación" class="crumbs">
          @for (crumb of crumbs(); track crumb.label; let first = $first) {
            <span class="row gap-1">
              @if (!first) {
                <medsys-icon name="chevron-right" [size]="12" class="crumb-sep" />
              }
              @if (crumb.link) {
                <a [routerLink]="crumb.link">{{ crumb.label }}</a>
              } @else {
                <span>{{ crumb.label }}</span>
              }
            </span>
          }
        </nav>
      }

      <div class="page-header-row">
        <div class="grow stack gap-1" style="min-width: 0">
          <div class="row gap-3 wrap">
            <h1 class="t-page">{{ heading() }}</h1>
            <ng-content select="[headerMeta]" />
          </div>
          @if (description()) {
            <p class="t-sec t-measure">{{ description() }}</p>
          }
        </div>
        <div class="row gap-2 wrap page-actions">
          <ng-content select="[headerActions]" />
        </div>
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  readonly crumbs = input<readonly Crumb[]>([]);
}
