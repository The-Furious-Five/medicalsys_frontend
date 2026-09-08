import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { API_BASE_URL } from '../../core/config/api-url';
import { dataResource } from '../../core/http/data-resource';
import { EMPTY_PAGE, Page } from '../../core/http/api-error';
import {
  Professional,
  ProfessionalLinkStatus,
  RegisterProfessionalInput,
  Specialty,
  UpdateProfessionalInput,
  UserAccount,
} from './professionals.models';

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
  /* ------------------------------------------------------- ficha y alta -- */

  /**
   * Un profesional por identificador.
   *
   * TODO(ms-profesionales): `GET /api/v1/professionals/{id}` **no existe**. El
   * controlador solo publica el listado y el alta; el detalle vive en
   * `GET /internal/v1/professionals/{id}`, que es el contrato con la agenda y
   * que el gateway no encamina (`application.yaml` solo expone
   * `/api/v1/professionals/**`). Hasta que se publique, la ficha muestra su
   * estado de error. Se deja escrita la ruta que corresponde en vez de
   * inventar un rodeo por el listado, que devolvería datos distintos: el
   * listado filtra por vínculo activo y ocultaría justo a quien se acaba de
   * desactivar, que es a quien se entra a ver.
   */
  professionalResource(professionalId: Signal<string | null>) {
    return dataResource(
      httpResource<Professional>(() => {
        const id = professionalId();
        return id ? `${this.baseUrl}/professionals/${id}` : undefined;
      }),
    );
  }

  /**
   * Cuentas de ms-identidad del centro, para elegir sobre cuál se da de alta.
   *
   * El alta exige `userAccountId` y no hay forma de deducirlo: el profesional
   * se registra sobre una cuenta que ya existe, y es esa cuenta la que después
   * inicia sesión y firma los encuentros. Se piden cien de una vez porque el
   * padrón de un centro es corto y así el desplegable no necesita paginar.
   */
  userAccountsResource() {
    return dataResource(
      httpResource<Page<UserAccount>>(
        () => {
          const organizationId = this.organizationId();
          if (organizationId === null) {
            return undefined;
          }
          return {
            url: `${this.baseUrl}/identity/users`,
            params: { organizationPublicId: organizationId, status: 'ACTIVE', size: 100 },
          };
        },
        { defaultValue: EMPTY_PAGE },
      ),
    );
  }

  /** Alta. Un 409 significa matrícula, documento o cuenta ya registrados. */
  register(body: RegisterProfessionalInput): Promise<Professional> {
    return firstValueFrom(this.http.post<Professional>(`${this.baseUrl}/professionals`, body));
  }

  /**
   * TODO(ms-profesionales): `PATCH /api/v1/professionals/{id}` no existe
   * todavía. El método queda escrito para que la hoja de edición, cuando se
   * construya, no tenga que decidir de nuevo la forma de la petición.
   */
  update(professionalId: string, body: UpdateProfessionalInput): Promise<Professional> {
    return firstValueFrom(
      this.http.patch<Professional>(`${this.baseUrl}/professionals/${professionalId}`, body),
    );
  }

  /**
   * Activa o desactiva el vínculo de un profesional con un centro.
   *
   * TODO(ms-profesionales): el endpoint está en desarrollo. Se asume
   * `PATCH /api/v1/professionals/{id}/organizations/{linkId}` con `{ status }`,
   * que es la forma que se acordó; conviene confirmarla antes de conectarla.
   *
   * Para desactivar se envía SUSPENDED y no ENDED: `OrganizationStatus` tiene
   * los dos, y solo el primero se entiende como reversible. ENDED describe un
   * vínculo terminado, que es otra decisión y merecería su propia acción.
   */
  setLinkStatus(
    professionalId: string,
    linkId: string,
    status: ProfessionalLinkStatus,
  ): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(
        `${this.baseUrl}/professionals/${professionalId}/organizations/${linkId}`,
        { status },
      ),
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
