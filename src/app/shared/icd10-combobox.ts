import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, Subject, switchMap } from 'rxjs';
import { CatalogsApiService } from '../features/catalogs/catalogs-api.service';
import { Icd10Entry } from '../features/catalogs/catalogs.models';
import { Icon } from '../core/ui/icon';

/**
 * Selector de diagnóstico CIE-10 respaldado por `ms-catalogos`.
 *
 * RF-05.2 y RF-06.1 exigen que el diagnóstico (y, cuando corresponda, el
 * diagnóstico asociado a una orden de estudio) se seleccione del catálogo
 * vigente, no que se escriba a mano. Por eso `value` sólo cambia cuando la
 * persona elige una fila de la lista devuelta por
 * `GET /api/v1/catalogs/cie10?q=`; teclear sin elegir nunca produce un código
 * válido para el formulario que lo usa.
 */
@Component({
  selector: 'medsys-icd10-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="ms-select" [class.is-open]="open()">
      <div class="row gap-2" style="align-items: center;">
        <input
          #inputEl
          class="input t-mono"
          [id]="controlId()"
          type="text"
          role="combobox"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="listId()"
          aria-haspopup="listbox"
          autocomplete="off"
          [placeholder]="placeholder()"
          [value]="query()"
          [disabled]="disabled()"
          (input)="onInput($any($event.target).value)"
          (focus)="onFocus()"
          (keydown)="onKey($event)"
        />
        @if (value()) {
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            title="Quitar selección"
            (click)="clear()"
          >
            <medsys-icon name="x" [size]="14" />
          </button>
        }
      </div>

      @if (value(); as chosen) {
        <p class="field-hint">
          Seleccionado: <span class="t-mono">{{ chosen }}</span>
          @if (selectedLabel(); as description) {
            — {{ description }}
          }
        </p>
      } @else {
        <p class="field-hint">Escribe un código o una descripción y elige una opción de la lista.</p>
      }

      @if (open()) {
        <ul class="ms-select-list popover" [id]="listId()" role="listbox" [attr.aria-label]="placeholder()">
          @if (loading()) {
            <li class="ms-select-option" aria-disabled="true">Buscando…</li>
          } @else if (query().trim().length === 0) {
            <li class="ms-select-option" aria-disabled="true">Escribe para buscar en el catálogo.</li>
          } @else if (results().length === 0) {
            <li class="ms-select-option" aria-disabled="true">Sin coincidencias en el catálogo.</li>
          } @else {
            @for (entry of results(); track entry.code; let i = $index) {
              <li
                class="ms-select-option"
                role="option"
                [class.is-active]="highlighted() === i"
                [attr.aria-selected]="entry.code === value()"
                (click)="choose(entry)"
                (mouseenter)="highlighted.set(i)"
              >
                <span class="t-mono">{{ entry.code }}</span>
                <span class="grow t-sec">{{ entry.description }}</span>
              </li>
            }
          }
        </ul>
      }
    </div>
  `,
})
export class Icd10Combobox {
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly query$ = new Subject<string>();

  readonly value = model<string>('');
  readonly placeholder = input<string>('Buscar por código o descripción, p. ej. J06.9');
  readonly controlId = input<string>(`icd10-combobox-${Math.random().toString(36).slice(2, 8)}`);
  readonly disabled = input(false);

  protected readonly query = signal('');
  protected readonly results = signal<readonly Icd10Entry[]>([]);
  protected readonly loading = signal(false);
  protected readonly open = signal(false);
  protected readonly highlighted = signal(0);
  protected readonly failed = signal(false);

  protected readonly listId = computed(() => `${this.controlId()}-list`);
  protected readonly selectedLabel = computed(
    () => this.results().find((entry) => entry.code === this.value())?.description ?? null,
  );

  constructor() {
    this.query$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((term) => {
          const trimmed = term.trim();
          if (!trimmed) {
            this.loading.set(false);
            return of<readonly Icd10Entry[]>([]);
          }
          this.loading.set(true);
          this.failed.set(false);
          return this.catalogsApi.searchIcd10(trimmed).pipe(
            catchError((_error: HttpErrorResponse) => {
              this.failed.set(true);
              return of<readonly Icd10Entry[]>([]);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((entries) => {
        this.results.set(entries);
        this.highlighted.set(0);
      });
  }

  protected onFocus(): void {
    this.open.set(true);
  }

  protected onInput(raw: string): void {
    // Escribir después de tener una selección la invalida: el código sólo es
    // válido mientras coincida con lo último elegido de la lista.
    if (this.value()) {
      this.value.set('');
      this.onChange('');
    }
    this.query.set(raw);
    this.open.set(true);
    this.query$.next(raw);
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.open() && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      this.open.set(true);
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlighted.update((i) => Math.min(this.results().length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlighted.update((i) => Math.max(0, i - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const entry = this.results()[this.highlighted()];
        if (entry) {
          this.choose(entry);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.open.set(false);
        break;
    }
  }

  protected choose(entry: Icd10Entry): void {
    this.value.set(entry.code);
    this.onChange(entry.code);
    this.query.set('');
    this.results.set([entry]);
    this.open.set(false);
  }

  protected clear(): void {
    this.value.set('');
    this.onChange('');
    this.query.set('');
    this.results.set([]);
    this.open.set(false);
  }

  private onChange: (value: string) => void = () => undefined;
}
