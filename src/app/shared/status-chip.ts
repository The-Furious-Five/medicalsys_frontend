import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { label } from '../core/labels/labels';
import { Tone, genericTone } from '../core/state/state-machines';

/**
 * Chip de estado.
 *
 * El color nunca va solo: siempre acompaña al texto del estado. Así el estado
 * sigue siendo legible con visión de color reducida, en una pantalla mala o
 * impreso en blanco y negro.
 */
@Component({
  selector: 'medsys-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value()) {
      <span class="chip" [class]="'chip-' + tone()" [class.chip-strike]="strike()">
        <span class="chip-dot" aria-hidden="true"></span>
        {{ text() }}
      </span>
    } @else {
      <span class="t-sec">—</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class StatusChip {
  readonly value = input<string | null | undefined>(null);
  readonly dictionary = input.required<Record<string, string>>();
  readonly tones = input<Record<string, Tone> | null>(null);
  readonly strike = input(false);

  protected readonly text = computed(() => label(this.dictionary(), this.value()));
  protected readonly tone = computed<Tone>(() => {
    const value = this.value();
    if (!value) {
      return 'neutral';
    }
    return this.tones()?.[value] ?? genericTone[value] ?? 'neutral';
  });
}
