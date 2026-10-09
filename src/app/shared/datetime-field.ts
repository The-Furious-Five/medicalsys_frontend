import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DateField } from './date-field';
import { TimeField } from './time-field';

/**
 * Campo de fecha y hora propio.
 *
 * Sustituye a `<input type="datetime-local">`, que es el peor de los controles
 * nativos: en Chrome pinta «dd/mm/aaaa, --:-- ----» con dos widgets del sistema
 * pegados, en Firefox no abre calendario y en Safari cambia la disposición de
 * los segmentos. No hay forma de darle la tipografía ni los radios del producto.
 *
 * No reinventa nada: reúne el calendario de {@link DateField} y la lista de
 * {@link TimeField} y los une en el mismo valor `aaaa-mm-ddTHH:mm` que espera el
 * backend. Una campaña sin hora arranca a las 00:00, que es lo que hacía el
 * control nativo cuando se dejaba el segmento vacío.
 */
@Component({
  selector: 'medsys-datetime-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateField, TimeField],
  providers: [
    { provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => DateTimeField) },
  ],
  templateUrl: './datetime-field.html',
})
export class DateTimeField implements ControlValueAccessor {
  /** Valor `aaaa-mm-ddTHH:mm`, el mismo que emitía el control nativo. */
  readonly value = model<string>('');
  readonly controlId = input<string>(`ms-dt-${Math.random().toString(36).slice(2, 8)}`);
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly stepMinutes = input(30);

  protected readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly datePart = computed(() => (this.value() || '').split('T')[0] ?? '');
  protected readonly timePart = computed(() =>
    ((this.value() || '').split('T')[1] ?? '').slice(0, 5),
  );

  /** El día sin hora se guarda a las 00:00: media fecha no es un instante. */
  protected readonly dayLimit = computed(() => ({
    min: (this.min() || '').split('T')[0] || null,
    max: (this.max() || '').split('T')[0] || null,
  }));

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected setDate(day: string): void {
    if (day === '') {
      this.commit('');
      return;
    }
    this.commit(`${day}T${this.timePart() || '00:00'}`);
  }

  protected setTime(time: string): void {
    const day = this.datePart();
    if (day === '') {
      // Una hora suelta no describe ningún instante: se ignora hasta que haya día.
      return;
    }
    this.commit(`${day}T${time || '00:00'}`);
  }

  private commit(value: string): void {
    if (this.value() !== value) {
      this.value.set(value);
    }
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: unknown): void {
    this.value.set(value === null || value === undefined ? '' : String(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
