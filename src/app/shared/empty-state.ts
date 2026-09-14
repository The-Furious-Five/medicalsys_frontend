import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../core/ui/icon';

/**
 * Vacío. Explica qué es la sección, por qué está vacía y ofrece la acción que
 * la llena. Un icono de línea, texto en dos niveles y un botón: nada más.
 */
@Component({
  selector: 'medsys-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="state">
      <span class="state-icon"><medsys-icon [name]="icon()" [size]="20" /></span>
      <div class="stack gap-1" style="align-items: center">
        <p class="state-title">{{ heading() }}</p>
        <p class="state-text">{{ description() }}</p>
      </div>
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input.required<IconName>();
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
}
