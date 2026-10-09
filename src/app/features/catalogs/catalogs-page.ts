import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import {
  APPLICABLE_SEX,
  CATALOG_STATUS,
  PHARMACEUTICAL_FORM,
  STUDY_CATEGORY,
  label,
} from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { CatalogsApiService } from './catalogs-api.service';
import { CatalogsConnection } from './catalogs-connection';
import { Icd10Entry, Medication, Specialty, StudyType } from './catalogs.models';

type CatalogTab = 'specialties' | 'cie10' | 'medications' | 'studies';

@Component({
  selector: 'medsys-catalogs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, StatusChip, ErrorState, EmptyState, TableSkeleton, Icon],
  templateUrl: './catalogs-page.html',
  styleUrl: './catalogs-page.scss',
})
export class CatalogsPage {
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly connection = inject(CatalogsConnection);
  private readonly cie10Query$ = new Subject<string>();

  protected readonly catalogStatuses = CATALOG_STATUS;
  protected readonly pharmaceuticalForms = PHARMACEUTICAL_FORM;
  protected readonly studyCategories = STUDY_CATEGORY;
  protected readonly applicableSexes = APPLICABLE_SEX;

  protected readonly activeTab = signal<CatalogTab>('specialties');
  protected readonly specialties = signal<readonly Specialty[]>([]);
  protected readonly medications = signal<readonly Medication[]>([]);
  protected readonly studyTypes = signal<readonly StudyType[]>([]);
  protected readonly cie10Results = signal<readonly Icd10Entry[]>([]);
  protected readonly specialtyFilter = signal('');
  protected readonly medicationFilter = signal('');
  protected readonly studyFilter = signal('');
  protected readonly cie10Query = signal('');
  protected readonly loading = signal(true);
  protected readonly cie10Loading = signal(false);
  protected readonly error = signal<unknown>(null);

  protected readonly filteredSpecialties = computed(() =>
    filterBy(this.specialties(), this.specialtyFilter(), (item) => [item.code, item.name]),
  );
  protected readonly filteredMedications = computed(() =>
    filterBy(this.medications(), this.medicationFilter(), (item) => [
      item.code,
      item.genericName,
      item.tradeName,
    ]),
  );
  protected readonly filteredStudyTypes = computed(() =>
    filterBy(this.studyTypes(), this.studyFilter(), (item) => [
      item.code,
      item.name,
      item.category,
    ]),
  );

  constructor() {
    this.reload();
    this.cie10Query$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((query) => {
          const term = query.trim();
          this.cie10Query.set(query);
          if (!term) {
            this.cie10Loading.set(false);
            return of<readonly Icd10Entry[]>([]);
          }
          this.cie10Loading.set(true);
          this.error.set(null);
          return this.catalogsApi.searchIcd10(term).pipe(
            catchError((error: HttpErrorResponse) => {
              this.setError(error);
              return of<readonly Icd10Entry[]>([]);
            }),
            finalize(() => this.cie10Loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((items) => this.cie10Results.set(items));
  }

  protected selectTab(tab: CatalogTab): void {
    this.activeTab.set(tab);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    let pending = 3;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        this.loading.set(false);
      }
    };

    this.catalogsApi
      .listSpecialties()
      .pipe(finalize(done))
      .subscribe({
        next: (items) => {
          this.specialties.set(items);
          this.connection.markOnline();
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
    this.catalogsApi
      .listMedications()
      .pipe(finalize(done))
      .subscribe({
        next: (items) => this.medications.set(items),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
    this.catalogsApi
      .listStudyTypes()
      .pipe(finalize(done))
      .subscribe({
        next: (items) => this.studyTypes.set(items),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected searchIcd10(query: string): void {
    this.cie10Query$.next(query);
  }

  protected clearSearch(): void {
    this.cie10Query.set('');
    this.cie10Query$.next('');
  }

  protected formLabel(value: string | null | undefined): string {
    return label(this.pharmaceuticalForms, value);
  }

  protected categoryLabel(value: string | null | undefined): string {
    return label(this.studyCategories, value);
  }

  protected sexLabel(value: string | null | undefined): string {
    return label(this.applicableSexes, value, 'Todos');
  }

  /**
   * Guarda el fallo tal como llegó, no traducido.
   *
   * `medsys-error-state` describe el problema con `describeFailure`, que empieza
   * comprobando `failure instanceof HttpErrorResponse`. Al guardar aquí el
   * `ApiError` que devuelve `toCatalogsError`, esa comprobación fallaba siempre y
   * la pantalla caía en el texto genérico «Ocurrió un problema inesperado al
   * preparar la vista», incluso con el gateway apagado. Pasando la respuesta
   * original, el usuario lee «El servicio no responde» y qué hacer al respecto.
   *
   * Con esto `toCatalogsError` deja de usarse en esta pantalla; el helper y su
   * prueba siguen en el módulo por si otra vista necesita el `ApiError` ya
   * traducido, pero hoy no lo consume nadie.
   */
  private setError(error: HttpErrorResponse): void {
    this.error.set(error);
    this.loading.set(false);
    this.cie10Loading.set(false);
    if (error.status === 0) {
      this.connection.markOffline();
    }
  }
}

function filterBy<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => Array<string | null | undefined>,
): readonly T[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return items;
  }
  return items.filter((item) => fields(item).some((field) => field?.toLowerCase().includes(term)));
}
