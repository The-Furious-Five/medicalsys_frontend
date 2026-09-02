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
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../core/ui/icon';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
/** La semana empieza en lunes, como en Bolivia. */
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Day {
  readonly iso: string;
  readonly day: number;
  readonly outside: boolean;
  readonly disabled: boolean;
  readonly today: boolean;
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Campo de fecha propio.
 *
 * `<input type="date">` delega el calendario al navegador: cambia de aspecto e
 * idioma entre Chrome, Safari y Firefox, y en algunos ni siquiera se puede
 * abrir con el teclado. Aquí el calendario es una capa más del producto.
 *
 * Se escribe la fecha a mano en dd/mm/aaaa —que es como la dicta un paciente— y
 * el calendario está para cuando se prefiere señalar. Los años se recorren por
 * décadas, porque la fecha que más se teclea en una clínica es una fecha de
 * nacimiento y llegar a 1958 mes a mes sería inaceptable.
 */
@Component({
  selector: 'medsys-date-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => DateField) },
  ],
  templateUrl: './date-field.html',
})
export class DateField implements ControlValueAccessor {
  /** Valor en ISO `aaaa-mm-dd`, el mismo formato que espera el backend. */
  readonly value = model<string>('');
  readonly controlId = input<string>(`ms-date-${Math.random().toString(36).slice(2, 8)}`);
  readonly max = input<string | null>(null);
  readonly min = input<string | null>(null);
  readonly invalid = input(false);
  readonly ariaLabel = input<string | null>(null);

  protected readonly open = signal(false);
  protected readonly text = signal('');
  protected readonly cursor = signal(new Date());
  protected readonly pickingYear = signal(false);
  protected readonly weekdays = WEEKDAYS;

  private readonly panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  protected readonly formDisabled = signal(false);

  protected readonly monthLabel = computed(() => {
    const at = this.cursor();
    return `${MONTHS[at.getMonth()]} de ${at.getFullYear()}`;
  });

  /** Rejilla de seis semanas: el alto no cambia al pasar de mes. */
  protected readonly days = computed<readonly Day[]>(() => {
    const at = this.cursor();
    const year = at.getFullYear();
    const month = at.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const todayIso = new Date().toLocaleDateString('en-CA');
    const min = this.min();
    const max = this.max();

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = iso(date.getFullYear(), date.getMonth(), date.getDate());
      return {
        iso: key,
        day: date.getDate(),
        outside: date.getMonth() !== month,
        disabled: (min !== null && key < min) || (max !== null && key > max),
        today: key === todayIso,
      };
    });
  });

  protected readonly years = computed(() => {
    const base = this.cursor().getFullYear();
    const start = base - (((base % 10) + 10) % 10) - 1;
    return Array.from({ length: 12 }, (_, index) => start + index);
  });

  constructor() {
    // El texto visible sigue al valor mientras no se esté escribiendo.
    effect(() => {
      const current = this.value();
      this.text.set(current ? this.toDisplay(current) : '');
      if (current) {
        const [y, m, d] = current.split('-').map(Number);
        this.cursor.set(new Date(y, m - 1, d));
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (this.open() && !(event.target as Element)?.closest('medsys-date-field')) {
        this.close(false);
      }
    });
  }

  private toDisplay(isoValue: string): string {
    const [y, m, d] = isoValue.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Acepta dd/mm/aaaa y dd-mm-aaaa; cualquier otra cosa deja el campo vacío. */
  private fromDisplay(text: string): string | null {
    const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text.trim());
    if (match === null) {
      return null;
    }
    const [, d, m, y] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
      return null;
    }
    return iso(date.getFullYear(), date.getMonth(), date.getDate());
  }

  protected onInput(raw: string): void {
    this.text.set(raw);
    const parsed = this.fromDisplay(raw);
    if (parsed !== null) {
      this.commit(parsed);
    } else if (raw.trim() === '') {
      this.commit('');
    }
  }

  /** Al salir del campo, un texto incompleto se descarta en vez de quedarse a
   *  medias insinuando una fecha que no existe. */
  protected onBlur(): void {
    this.onTouched();
    const parsed = this.fromDisplay(this.text());
    this.text.set(this.value() ? this.toDisplay(this.value()) : parsed === null ? '' : this.text());
  }

  protected toggle(): void {
    this.open.update((value) => !value);
    if (this.open()) {
      this.pickingYear.set(false);
      queueMicrotask(() => this.panel()?.nativeElement.focus());
    }
  }

  protected shiftMonth(delta: number): void {
    const at = this.cursor();
    this.cursor.set(new Date(at.getFullYear(), at.getMonth() + delta, 1));
  }

  protected shiftYearPage(delta: number): void {
    const at = this.cursor();
    this.cursor.set(new Date(at.getFullYear() + delta * 10, at.getMonth(), 1));
  }

  protected chooseYear(year: number): void {
    const at = this.cursor();
    this.cursor.set(new Date(year, at.getMonth(), 1));
    this.pickingYear.set(false);
  }

  protected select(day: Day): void {
    if (day.disabled) {
      return;
    }
    this.commit(day.iso);
    this.close(true);
  }

  protected onPanelKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    }
  }

  private commit(next: string): void {
    this.value.set(next);
    this.onChange(next);
  }

  private close(refocus: boolean): void {
    this.open.set(false);
    this.onTouched();
    if (refocus) {
      document.getElementById(this.controlId())?.focus();
    }
  }

  /* -------------------------------------------------- ControlValueAccessor -- */

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
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
