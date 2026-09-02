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

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Desplegable propio.
 *
 * Sustituye a `<select>` porque el nativo lo dibuja el sistema operativo: su
 * lista no acepta ni la tipografía, ni los radios, ni los colores de la
 * aplicación, y cambia de aspecto entre macOS, Windows y Android. Aquí la lista
 * es la misma superficie que el resto de capas del producto.
 *
 * Se reimplementa el comportamiento que el nativo daba gratis, porque perderlo
 * sería un retroceso:
 *   · `role="combobox"` con la lista asociada por `aria-controls`;
 *   · flechas, Inicio y Fin para recorrer, Enter o Espacio para elegir;
 *   · escribir salta a la opción que empieza por esas letras;
 *   · `Esc` cierra y devuelve el foco al control;
 *   · la lista se abre hacia arriba si no cabe hacia abajo.
 */
@Component({
  selector: 'medsys-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  // Se registra como accesor de valor para poder usarse con `formControlName`
  // igual que el `<select>` al que sustituye.
  providers: [{ provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => Select) }],
  template: `
    <div class="ms-select" [class.is-open]="open()">
      <button
        #trigger
        type="button"
        class="ms-select-trigger"
        role="combobox"
        [id]="controlId()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId()"
        aria-haspopup="listbox"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-invalid]="invalid() || null"
        [disabled]="isDisabled()"
        (click)="toggle()"
        (keydown)="onTriggerKey($event)"
      >
        <span class="ms-select-value" [class.is-placeholder]="selectedLabel() === null">
          {{ selectedLabel() ?? placeholder() }}
        </span>
        <medsys-icon name="chevron-down" [size]="14" class="ms-select-caret" />
      </button>

      @if (open()) {
        <ul
          #list
          class="ms-select-list popover"
          [class.is-above]="above()"
          [id]="listId()"
          role="listbox"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-activedescendant]="activeId()"
          tabindex="-1"
          (keydown)="onListKey($event)"
        >
          @if (placeholder() && allowEmpty()) {
            <li
              class="ms-select-option"
              role="option"
              [id]="controlId() + '-opt--1'"
              [class.is-active]="highlighted() === -1"
              [attr.aria-selected]="value() === ''"
              (click)="choose('')"
              (mouseenter)="highlighted.set(-1)"
            >
              <span class="grow">{{ placeholder() }}</span>
              @if (value() === '') {
                <medsys-icon name="check" [size]="14" [strokeWidth]="2.2" />
              }
            </li>
          }

          @for (option of options(); track option.value; let i = $index) {
            <li
              class="ms-select-option"
              role="option"
              [id]="controlId() + '-opt-' + i"
              [class.is-active]="highlighted() === i"
              [attr.aria-selected]="option.value === value()"
              (click)="choose(option.value)"
              (mouseenter)="highlighted.set(i)"
            >
              <span class="grow">{{ option.label }}</span>
              @if (option.value === value()) {
                <medsys-icon name="check" [size]="14" [strokeWidth]="2.2" />
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class Select implements ControlValueAccessor {
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<string>('');
  readonly placeholder = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly controlId = input<string>(`ms-select-${Math.random().toString(36).slice(2, 8)}`);
  readonly disabled = input(false);
  readonly invalid = input(false);
  /** Con marcador de posición, permite volver a «sin elegir». */
  readonly allowEmpty = input(true);

  /** Deshabilitado por la propia entrada o por el formulario que la controla. */
  protected readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly open = signal(false);
  protected readonly highlighted = signal(0);
  protected readonly above = signal(false);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');
  private typeahead = '';
  private typeaheadTimer?: number;

  protected readonly listId = computed(() => `${this.controlId()}-list`);
  protected readonly selectedLabel = computed(() => {
    const current = this.value();
    return this.options().find((option) => option.value === current)?.label ?? null;
  });
  protected readonly activeId = computed(() => `${this.controlId()}-opt-${this.highlighted()}`);

  constructor() {
    // Al abrir, el foco pasa a la lista y se resalta lo que ya está elegido:
    // así el teclado empieza donde el usuario lo dejó, no en la primera opción.
    effect(() => {
      if (!this.open()) {
        return;
      }
      const index = this.options().findIndex((option) => option.value === this.value());
      this.highlighted.set(index);
      queueMicrotask(() => {
        this.placeList();
        this.list()?.nativeElement.focus();
        this.scrollToHighlighted();
      });
    });

    document.addEventListener('pointerdown', (event) => {
      if (this.open() && !(event.target as Element)?.closest('medsys-select')) {
        this.open.set(false);
      }
    });
  }

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  /** Si no cabe debajo, la lista se abre hacia arriba en vez de salirse. */
  private placeList(): void {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const listHeight = this.list()?.nativeElement.offsetHeight ?? 0;
    this.above.set(rect.bottom + listHeight + 8 > window.innerHeight && rect.top > listHeight);
  }

  /** Mantener la opción resaltada a la vista es una comodidad, no un requisito:
   *  si el entorno no ofrece `scrollIntoView`, el desplegable sigue siendo
   *  utilizable y no debe romperse por ello. */
  private scrollToHighlighted(): void {
    const element = this.list()?.nativeElement.querySelector<HTMLElement>('.is-active');
    element?.scrollIntoView?.({ block: 'nearest' });
  }

  private move(delta: number): void {
    const total = this.options().length;
    if (total === 0) {
      return;
    }
    const next = Math.min(total - 1, Math.max(0, this.highlighted() + delta));
    this.highlighted.set(next);
    queueMicrotask(() => this.scrollToHighlighted());
  }

  protected onTriggerKey(event: KeyboardEvent): void {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      this.open.set(true);
    }
  }

  protected onListKey(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.highlighted.set(0);
        queueMicrotask(() => this.scrollToHighlighted());
        break;
      case 'End':
        event.preventDefault();
        this.highlighted.set(this.options().length - 1);
        queueMicrotask(() => this.scrollToHighlighted());
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.choose(this.options()[this.highlighted()]?.value ?? '');
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
      case 'Tab':
        this.open.set(false);
        break;
      default:
        this.onTypeahead(event);
    }
  }

  /** Escribir salta a la primera opción que empieza por esas letras, como el
   *  desplegable del sistema. Se olvida lo tecleado tras una pausa. */
  private onTypeahead(event: KeyboardEvent): void {
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    this.typeahead += event.key.toLowerCase();
    window.clearTimeout(this.typeaheadTimer);
    this.typeaheadTimer = window.setTimeout(() => (this.typeahead = ''), 600);

    const index = this.options().findIndex((option) =>
      option.label.toLowerCase().startsWith(this.typeahead),
    );
    if (index >= 0) {
      this.highlighted.set(index);
      queueMicrotask(() => this.scrollToHighlighted());
    }
  }

  protected choose(value: string): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
    this.close();
  }

  /* ------------------------------------------------ ControlValueAccessor -- */

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

  private close(): void {
    this.open.set(false);
    this.onTouched();
    this.trigger().nativeElement.focus();
  }
}
