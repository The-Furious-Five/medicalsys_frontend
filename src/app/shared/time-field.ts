import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../core/ui/icon';

/**
 * Campo de hora propio.
 *
 * `<input type="time">` lo dibuja cada navegador a su manera: Chrome muestra
 * am/pm según el idioma del sistema —no el de la aplicación—, Firefox no abre
 * ninguna lista y Safari cambia el orden de los campos. En una agenda donde la
 * hora se teclea decenas de veces al día, esa inconsistencia se paga.
 *
 * Aquí se escribe `hh:mm` en 24 horas, que es como se dicta un turno, y la lista
 * ofrece los huecos de la jornada en el intervalo que pida la pantalla.
 */
@Component({
  selector: 'medsys-time-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => TimeField) },
  ],
  templateUrl: './time-field.html',
})
export class TimeField implements ControlValueAccessor {
  /** Valor en `HH:mm`, el mismo formato que envía el input nativo. */
  readonly value = model<string>('');
  readonly controlId = input<string>(`ms-time-${Math.random().toString(36).slice(2, 8)}`);
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);
  /** Salto de la lista, en minutos. */
  readonly stepMinutes = input(30);
  readonly fromHour = input(6);
  readonly toHour = input(22);

  protected readonly open = signal(false);
  protected readonly text = signal('');
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  protected readonly formDisabled = signal(false);
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

  private readonly panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly slots = computed<readonly string[]>(() => {
    const step = Math.max(5, this.stepMinutes());
    const start = this.fromHour() * 60;
    const end = this.toHour() * 60;
    const out: string[] = [];
    for (let minutes = start; minutes <= end; minutes += step) {
      out.push(
        `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      );
    }
    return out;
  });

  constructor() {
    effect(() => {
      const current = this.value();
      // Mismo motivo que en NumberField: sin `untracked`, el efecto depende del
      // texto que se está tecleando y lo revierte en cada pulsación.
      if (untracked(() => this.parse(this.text())) !== current) {
        this.text.set(current ?? '');
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (this.open() && !(event.target as Element)?.closest('medsys-time-field')) {
        this.close();
      }
    });
  }

  /** Acepta `9`, `930`, `9:3`, `09:30`. Devuelve `HH:mm` o cadena vacía. */
  private parse(raw: string): string {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') {
      return '';
    }
    let hours: number;
    let minutes: number;
    if (digits.length <= 2) {
      hours = Number(digits);
      minutes = 0;
    } else if (digits.length === 3) {
      hours = Number(digits.slice(0, 1));
      minutes = Number(digits.slice(1));
    } else {
      hours = Number(digits.slice(0, 2));
      minutes = Number(digits.slice(2, 4));
    }
    if (hours > 23 || minutes > 59) {
      return '';
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  protected onInput(raw: string): void {
    // Se deja escribir libremente: el texto sólo se normaliza al salir, para que
    // «9» de camino a «9:30» no se convierta en «09:00» en la primera tecla.
    // Lo que sí se descarta al vuelo es lo que no puede ser una hora.
    const limpio = raw.replace(/[^\d:]/g, '').slice(0, 5);
    // Igual que en NumberField: si lo tecleado se limpia al mismo texto que ya
    // había, la señal no cambia y sin esta escritura el carácter inválido se
    // quedaría visible.
    const elemento = this.campo()?.nativeElement;
    if (elemento !== undefined && elemento.value !== limpio) {
      elemento.value = limpio;
    }
    this.text.set(limpio);
    const parsed = this.parse(limpio);
    if (parsed !== '' && limpio.length >= 4) {
      this.commit(parsed);
    } else if (limpio === '') {
      this.commit('');
    }
  }

  protected onBlur(): void {
    this.onTouched();
    const parsed = this.parse(this.text());
    this.text.set(parsed);
    this.commit(parsed);
  }

  protected toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    this.open.update((value) => !value);
    if (this.open()) {
      queueMicrotask(() => this.panel()?.nativeElement.focus());
    }
  }

  protected choose(slot: string): void {
    this.text.set(slot);
    this.commit(slot);
    this.close();
  }

  protected onPanelKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
    }
  }

  private close(): void {
    this.open.set(false);
  }

  private commit(value: string): void {
    if (this.value() !== value) {
      this.value.set(value);
    }
    this.onChange(value);
  }

  writeValue(value: unknown): void {
    const text = value === null || value === undefined ? '' : String(value).slice(0, 5);
    this.text.set(text);
    this.value.set(this.parse(text));
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
