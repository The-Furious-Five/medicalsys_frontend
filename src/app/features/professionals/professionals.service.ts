import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { API_BASE_URL } from '../../core/config/api-url';
import { dataResource } from '../../core/http/data-resource';
import { Professional, Specialty } from './professionals.models';

/**
 * ms-profesionales · `/api/v1/professionals` y el catálogo de especialidades.
 *
 * La agenda es de un centro concreto, así que la organización sale de la sesión
 * y no de cada pantalla: pedirla por parámetro solo abriría la puerta a que dos
 * vistas consultaran agendas distintas sin querer.
 */
@Injectable({ providedIn: 'root' })
export class ProfessionalsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(AuthSession);

  readonly organizationId = computed(() => this.session.user()?.organizationPublicId ?? null);

  /** Profesionales activos del centro, opcionalmente de una sola especialidad. */
  professionalsResource(specialtyCode?: Signal<string | null>) {
    return dataResource(
      httpResource<readonly Professional[]>(
        () => {
          const organizationId = this.organizationId();
          if (organizationId === null) {
            return undefined;
          }
          const code = specialtyCode?.() ?? null;
          return {
            url: `${this.baseUrl}/professionals`,
            params: { organizationId, ...(code ? { specialtyCode: code } : {}) },
          };
        },
        { defaultValue: [] },
      ),
    );
  }

  specialtiesResource() {
    return dataResource(
      httpResource<readonly Specialty[]>(() => `${this.baseUrl}/catalogs/specialties`, {
        defaultValue: [],
      }),
    );
  }

  list(specialtyCode?: string): Promise<readonly Professional[]> {
    const organizationId = this.organizationId();
    if (organizationId === null) {
      return Promise.resolve([]);
    }
    return firstValueFrom(
      this.http.get<readonly Professional[]>(`${this.baseUrl}/professionals`, {
        params: { organizationId, ...(specialtyCode ? { specialtyCode } : {}) },
      }),
    );
  }
}

/**
 * Vínculo activo del profesional con este centro. ms-agenda pide su
 * identificador para saber qué reglas de disponibilidad aplicar; sin él no hay
 * huecos que ofrecer, así que quien lo necesite debe comprobar el nulo.
 */
export function activeLink(professional: Professional, organizationId: string): string | null {
  const links = professional.organizations.filter((link) => link.organizationId === organizationId);
  return (links.find((link) => link.status === 'ACTIVE') ?? links[0])?.id ?? null;
}

/** Especialidad principal; si no está marcada, la primera declarada. */
export function primarySpecialtyCode(professional: Professional): string | null {
  const specialties = professional.specialties;
  return (specialties.find((item) => item.primary) ?? specialties[0])?.code ?? null;
}
