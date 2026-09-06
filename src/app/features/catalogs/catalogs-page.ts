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
import { ApiError } from '../../core/http/api-error';
import { CatalogsApiService } from './catalogs-api.service';
import { CatalogsConnection } from './catalogs-connection';
import { toCatalogsError } from './catalogs-error';
import { Icd10Entry, Medication, Specialty, StudyType } from './catalogs.models';

type CatalogTab = 'specialties' | 'cie10' | 'medications' | 'studies';

const ENUM_LABELS: Record<string, string> = {
  TABLET: 'Comprimido',
  CAPSULE: 'Cápsula',
  SYRUP: 'Jarabe',
  SUSPENSION: 'Suspensión',
  INJECTABLE: 'Inyectable',
  CREAM: 'Crema',
  OINTMENT: 'Ungüento',
  DROPS: 'Gotas',
  SUPPOSITORY: 'Supositorio',
  PATCH: 'Parche',
  AEROSOL: 'Aerosol',
  ORAL: 'Oral',
  INTRAVENOUS: 'Intravenosa',
  INTRAMUSCULAR: 'Intramuscular',
  SUBCUTANEOUS: 'Subcutánea',
  TOPICAL: 'Tópica',
  OPHTHALMIC: 'Oftálmica',
  OTIC: 'Ótica',
  NASAL: 'Nasal',
  RECTAL: 'Rectal',
  INHALATION: 'Inhalación',
  LABORATORY: 'Laboratorio',
  IMAGING: 'Imagen',
  PATHOLOGY: 'Patología',
  CARDIOLOGY: 'Cardiología',
  ENDOSCOPY: 'Endoscopía',
  BOTH: 'Todos',
  M: 'Masculino',
  F: 'Femenino',
  OTHER: 'Otro',
};

@Component({
  selector: 'medsys-catalogs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogs-page.html',
  styleUrl: './catalogs-page.scss',
})
export class CatalogsPage {
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly connection = inject(CatalogsConnection);
  private readonly cie10Query$ = new Subject<string>();

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
  protected readonly error = signal<ApiError | null>(null);
  protected readonly copiedCorrelationId = signal(false);

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

  protected label(value: string | null | undefined, fallback = '—'): string {
    if (!value) {
      return fallback;
    }
    return ENUM_LABELS[value] ?? value.replaceAll('_', ' ').toLowerCase();
  }

  protected copyCorrelationId(correlationId: string): void {
    void navigator.clipboard.writeText(correlationId).then(() => {
      this.copiedCorrelationId.set(true);
      window.setTimeout(() => this.copiedCorrelationId.set(false), 2000);
    });
  }

  private setError(error: HttpErrorResponse): void {
    this.error.set(toCatalogsError(error));
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
