import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import type { AuditFilters, AuditIntegrity, AuditPage, AuditSummary } from './audit-event';

/**
 * Cliente HTTP de la bitácora.
 *
 * Solo consume el gateway (`/api/v1/audit/**`). Las rutas `/internal/v1/audit-events` existen pero
 * son exclusivamente entre microservicios: el navegador no escribe auditoría, porque una bitácora
 * que el cliente puede redactar no prueba nada.
 */
@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/audit`;

  search(filters: AuditFilters, page: number, size: number): Observable<AuditPage> {
    const params = this.toParams(filters).set('page', page).set('size', size);
    return this.http.get<AuditPage>(`${this.baseUrl}/events`, { params });
  }

  summary(from?: string, to?: string, organizationId?: string): Observable<AuditSummary> {
    let params = new HttpParams();
    if (organizationId) {
      params = params.set('organizationId', organizationId);
    }
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<AuditSummary>(`${this.baseUrl}/summary`, { params });
  }

  integrity(window?: number, organizationId?: string): Observable<AuditIntegrity> {
    let params = window ? new HttpParams().set('window', window) : new HttpParams();
    if (organizationId) {
      params = params.set('organizationId', organizationId);
    }
    return this.http.get<AuditIntegrity>(`${this.baseUrl}/integrity`, { params });
  }

  /**
   * Descarga la exportación como blob.
   *
   * No se usa un `<a href>` directo: la ruta exige `Authorization`, y una navegación del navegador
   * no pasa por el interceptor que agrega el token.
   */
  exportCsv(filters: AuditFilters): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/events/export`, {
      params: this.toParams(filters),
      responseType: 'blob',
    });
  }

  /**
   * Convierte el filtro a query params omitiendo lo vacío.
   *
   * Enviar `category=` vacío no es lo mismo que no enviarlo: el backend lo trataría como un valor de
   * enum inválido y respondería 400 en vez de no filtrar.
   */
  private toParams(filters: AuditFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string' && value.trim() !== '') {
        params = params.set(key, value.trim());
      }
    }
    return params;
  }
}
