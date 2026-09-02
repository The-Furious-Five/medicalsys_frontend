import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import { Patient, RegisterPatientInput } from './patients.models';

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Caché por identificador: una tabla de veinte filas del mismo paciente no
   *  debe provocar veinte peticiones idénticas. */
  private readonly cache = new Map<string, Promise<Patient>>();

  searchResource(term: Signal<string>, page: Signal<number> = signal(0)) {
    return dataResource(
      httpResource<Page<Patient>>(() => ({
        url: `${this.baseUrl}/patients`,
        params: { size: 20, page: page(), ...(term().trim() ? { q: term().trim() } : {}) },
      })),
    );
  }

  patientResource(patientId: Signal<string | null>) {
    return dataResource(
      httpResource<Patient>(() => {
        const id = patientId();
        return id ? `${this.baseUrl}/patients/${id}` : undefined;
      }),
    );
  }

  get(patientId: string): Promise<Patient> {
    let pending = this.cache.get(patientId);
    if (pending === undefined) {
      pending = firstValueFrom(this.http.get<Patient>(`${this.baseUrl}/patients/${patientId}`));
      this.cache.set(patientId, pending);
      // Un fallo no debe quedar cacheado: la próxima vista debe poder reintentar.
      pending.catch(() => this.cache.delete(patientId));
    }
    return pending;
  }

  search(term: string, size = 6): Promise<Page<Patient>> {
    return firstValueFrom(
      this.http.get<Page<Patient>>(`${this.baseUrl}/patients`, {
        params: { size, ...(term.trim() ? { q: term.trim() } : {}) },
      }),
    );
  }

  register(body: RegisterPatientInput): Promise<Patient> {
    return firstValueFrom(this.http.post<Patient>(`${this.baseUrl}/patients`, body));
  }
}
