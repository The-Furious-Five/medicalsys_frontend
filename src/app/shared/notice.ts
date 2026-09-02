import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../core/ui/icon';

/** Aviso en línea dentro de una vista o un formulario. */
@Component({
  selector: 'medsys-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="notice" [class]="tone() !== 'neutral' ? 'notice notice-' + tone() : 'notice'">
      @if (icon(); as iconName) {
        <span style="margin-top: 1px"><medsys-icon [name]="iconName" [size]="15" /></span>
      }
      <div class="stack gap-1 grow">
        @if (heading()) {
          <span class="notice-title">{{ heading() }}</span>
        }
        <div><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Notice {
  readonly tone = input<'neutral' | 'warn' | 'err' | 'ok'>('neutral');
  readonly heading = input<string | null>(null);
  readonly icon = input<IconName | null>(null);
}
