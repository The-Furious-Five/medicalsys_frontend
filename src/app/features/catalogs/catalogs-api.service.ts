import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../../core/config/api-url';
import { Icd10Entry, Medication, Specialty, StudyType } from './catalogs.models';

@Injectable({ providedIn: 'root' })
export class CatalogsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  listSpecialties() {
    return this.http.get<readonly Specialty[]>(`${this.apiBaseUrl}/catalogs/specialties`);
  }

  searchIcd10(query: string) {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<readonly Icd10Entry[]>(`${this.apiBaseUrl}/catalogs/cie10`, { params });
  }

  listMedications() {
    return this.http.get<readonly Medication[]>(`${this.apiBaseUrl}/catalogs/medications`);
  }

  listStudyTypes() {
    return this.http.get<readonly StudyType[]>(`${this.apiBaseUrl}/catalogs/study-types`);
  }
}
