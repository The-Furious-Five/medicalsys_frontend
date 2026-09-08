import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../core/ui/icon';

/** Los límites llegan del backend o de una tabla, unas veces como número y otras como texto. */
function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Campo numérico propio.
 *
 * `<input type="number">` trae tres comportamientos del navegador que en una
 * clínica hacen daño:
 *
 *  1. Las flechas de incremento las dibuja el sistema operativo, cambian de
 *     tamaño y de sitio entre navegadores y no aceptan la tipografía ni los
 *     colores de este sistema.
 *  2. La rueda del ratón modifica el valor cuando el campo tiene el foco. Basta
 *     desplazar la página con el cursor encima de «Presión sistólica» para
 *     cambiar una constante vital sin darse cuenta y sin dejar rastro.
 *  3. El valor se pierde entero cuando el texto no es un número válido, así que
 *     un «120,» a medio teclear se convierte en cadena vacía.
 *
 * Aquí el valor viaja como texto —igual que en el input nativo, para no cambiar
 * el contrato de quien lo usa—, la rueda no lo toca y los pasos son dos botones
 * del producto.
 */
@Component({
  selector: 'medsys-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => NumberField) },
  ],
  templateUrl: './number-field.html',
})
export class NumberField implements ControlValueAccessor {
  /**
   * Entrada y salida no son del mismo tipo a proposito.
   *
   * Quien lo usa tiene el valor en una senal de numero (`capacity()`) o en una de
   * texto (`draftValue('systolicPressure')`), asi que entra cualquiera de los
   * dos. Sale siempre texto, que es lo que emitia el input nativo y lo que
   * esperan los `.set(+$event || 1)` de las pantallas.
   */
  readonly value = input<string | number | null>('');
  readonly valueChange = output<string>();
  readonly controlId = input<string>(`ms-num-${Math.random().toString(36).slice(2, 8)}`);
  readonly min = input(null, { transform: toNumberOrNull });
  readonly max = input(null, { transform: toNumberOrNull });
  readonly step = input(1, { transform: (value: number | string) => Number(value) || 1 });
  readonly placeholder = input<string>('');
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);
  /** Unidad que se pinta dentro del campo: «mmHg», «Bs», «min». */
  readonly suffix = input<string | null>(null);
  /** Oculta los botones de paso donde no aportan, como un importe libre. */
  readonly steppers = input(true);

  protected readonly text = signal('');
  protected readonly formDisabled = signal(false);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  /**
   * El texto se escribe en el elemento, no se deja al binding `[value]`.
   *
   * Un campo que sanea lo tecleado no puede depender de la comparación que hace
   * Angular contra el último valor enlazado: al escribir «abc» el componente
   * normaliza a cadena vacía, que es justo lo que Angular ya tenía anotado, así
   * que no repinta y el «abc» se queda en pantalla. Lo mismo pasaba al corregir
   * una hora imposible. Escribiendo el valor a mano, lo que se ve es siempre lo
   * que el componente considera válido.
   */
  private readonly sincronizarDom = effect(() => {
    const elemento = this.campo()?.nativeElement;
    const texto = this.text();
    if (elemento !== undefined && elemento.value !== texto) {
      elemento.value = texto;
    }
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // El texto sigue al valor de fuera salvo mientras se escribe algo que aún no
    // es un número: «-», «12.» y «» son estados legítimos a mitad de tecleo y no
    // deben provocar un repintado que borre lo tecleado.
    effect(() => {
      const entrante = this.value();
      const texto = entrante === null || entrante === undefined ? '' : String(entrante);
      // `untracked` es imprescindible: leer `text()` como dependencia hacía que el
      // efecto se reejecutara en cada tecla y devolviera el campo al valor de
      // fuera, de modo que escribir era imposible. El efecto solo debe responder
      // a que el valor cambie desde el componente padre.
      if (untracked(() => this.normalise(this.text())) !== this.normalise(texto)) {
        this.text.set(texto);
      }
    });
  }

  /** Deja pasar dígitos, un separador decimal y un signo inicial. Nada más. */
  private clean(raw: string): string {
    let out = raw.replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const negative = out.startsWith('-') && (this.min() === null || (this.min() as number) < 0);
    out = out.replace(/-/g, '');
    const parts = out.split('.');
    out = parts.length > 1 ? `${parts.shift()}.${parts.join('')}` : out;
    return negative ? `-${out}` : out;
  }

  private normalise(text: string): string {
    const cleaned = this.clean(text);
    return cleaned === '' || cleaned === '-' || cleaned === '.' ? '' : cleaned;
  }

  private clamp(n: number): number {
    const min = this.min();
    const max = this.max();
    if (min !== null && n < min) {
      return min;
    }
    if (max !== null && n > max) {
      return max;
    }
    return n;
  }

  protected onInput(raw: string): void {
    const cleaned = this.clean(raw);
    // Se escribe en el elemento aquí y no solo a través de la señal: cuando lo
    // tecleado se limpia a algo que ya era el valor anterior -escribir «abc»
    // sobre un campo vacío- la señal no cambia, no hay repintado y el texto
    // inválido se quedaría en pantalla.
    this.escribirEnCampo(cleaned);
    this.text.set(cleaned);
    this.commit(this.normalise(cleaned));
  }

  private escribirEnCampo(texto: string): void {
    const elemento = this.campo()?.nativeElement;
    if (elemento !== undefined && elemento.value !== texto) {
      elemento.value = texto;
    }
  }

  /**
   * Al salir del campo se aplican los límites.
   *
   * No se aplican mientras se teclea: con `min=18`, escribir «120» pasa por «1»
   * y saltaría a «18» en la primera tecla, dejando al usuario peleando con su
   * propio campo.
   */
  protected onBlur(): void {
    this.onTouched();
    const current = this.normalise(this.text());
    if (current === '') {
      this.text.set('');
      this.commit('');
      return;
    }
    const clamped = this.clamp(Number(current));
    const next = String(clamped);
    this.text.set(next);
    this.commit(next);
  }

  protected nudge(direction: 1 | -1): void {
    if (this.isDisabled()) {
      return;
    }
    const current = this.normalise(this.text());
    const base = current === '' ? (this.min() ?? 0) : Number(current);
    const stepped = this.clamp(Number((base + direction * this.step()).toFixed(6)));
    const next = String(stepped);
    this.text.set(next);
    this.commit(next);
  }

  /** Flechas del teclado: el mismo paso que los botones, sin el input nativo. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.nudge(event.key === 'ArrowUp' ? 1 : -1);
    }
  }

  private commit(value: string): void {
    this.valueChange.emit(value);
    this.onChange(value);
  }

  writeValue(value: unknown): void {
    this.text.set(value === null || value === undefined ? '' : String(value));
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
