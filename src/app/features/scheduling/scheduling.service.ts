import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import {
  Appointment,
  AppointmentHistoryEntry,
  Availability,
  CreateAppointmentInput,
  CreateAvailabilityInput,
  CreateBlockInput,
  CreateResourceInput,
  DaySlots,
  PhysicalResource,
  RescheduleInput,
  ResourceReservation,
  ResourceStatus,
  ScheduleBlock,
  StatusChangeInput,
  UpdateResourceInput,
} from './scheduling.models';

/** Rango de consulta del tablero: dos instantes ISO con desfase. */
export interface Range {
  readonly from: string;
  readonly to: string;
}

/** Acciones de estado, con la ruta que ms-agenda expone para cada destino. */
const STATUS_ENDPOINT = {
  CONFIRMED: 'confirm',
  WAITING: 'check-in',
  IN_PROGRESS: 'start',
  ATTENDED: 'complete',
  NO_SHOW: 'no-show',
  CANCELLED: 'cancel',
} as const;

export type StatusAction = keyof typeof STATUS_ENDPOINT;

/**
 * ms-agenda.
 *
 * Las lecturas son `httpResource` —`value`, `isLoading`, `error`, `reload`—
 * porque son exactamente los estados que el tablero tiene que dibujar. Las
 * escrituras devuelven promesa: quien las lanza necesita esperar el resultado
 * para cerrar su formulario o refrescar el día.
 *
 * La organización sale de la sesión y nunca de la pantalla: la agenda que se ve
 * es siempre la del centro en el que se inició sesión.
 */
@Injectable({ providedIn: 'root' })
export class SchedulingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(AuthSession);

  readonly organizationId = computed(() => this.session.user()?.organizationPublicId ?? null);
  readonly userId = computed(() => this.session.user()?.publicId ?? null);

  private get scheduling(): string {
    return `${this.baseUrl}/scheduling`;
  }

  /* ------------------------------------------------------------- citas -- */

  /** Citas de un rango. El tablero pide hasta cien: un día de un centro mediano
   *  cabe de sobra y evita paginar dentro de una rejilla de horas. */
  appointmentsResource(
    range: Signal<Range | null>,
    filters?: {
      readonly status?: Signal<string | null>;
      readonly professionalId?: Signal<string | null>;
      readonly branchId?: Signal<string | null>;
      readonly size?: number;
    },
  ) {
    return dataResource(
      httpResource<Page<Appointment>>(() => {
        const organizationPublicId = this.organizationId();
        const window = range();
        if (organizationPublicId === null || window === null) {
          return undefined;
        }
        const status = filters?.status?.() ?? null;
        const professional = filters?.professionalId?.() ?? null;
        const branch = filters?.branchId?.() ?? null;
        return {
          url: `${this.scheduling}/appointments`,
          params: {
            organizationPublicId,
            from: window.from,
            to: window.to,
            size: filters?.size ?? 100,
            ...(status ? { status } : {}),
            ...(professional ? { healthProfessionalPublicId: professional } : {}),
            ...(branch ? { branchPublicId: branch } : {}),
          },
        };
      }),
    );
  }

  /** Bandeja de citas: paginada y con filtros independientes del tablero. */
  appointmentSearchResource(filters: {
    readonly page: Signal<number>;
    readonly status: Signal<string | null>;
    readonly professionalId: Signal<string | null>;
    readonly patientId: Signal<string | null>;
    readonly range: Signal<Range | null>;
    readonly size?: number;
  }) {
    return dataResource(
      httpResource<Page<Appointment>>(() => {
        const organizationPublicId = this.organizationId();
        if (organizationPublicId === null) {
          return undefined;
        }
        const window = filters.range();
        const status = filters.status();
        const professional = filters.professionalId();
        const patient = filters.patientId();
        return {
          url: `${this.scheduling}/appointments`,
          params: {
            organizationPublicId,
            page: filters.page(),
            size: filters.size ?? 20,
            ...(window ? { from: window.from, to: window.to } : {}),
            ...(status ? { status } : {}),
            ...(professional ? { healthProfessionalPublicId: professional } : {}),
            ...(patient ? { patientPublicId: patient } : {}),
          },
        };
      }),
    );
  }

  appointmentResource(appointmentId: Signal<string | null>) {
    return dataResource(
      httpResource<Appointment>(() => {
        const id = appointmentId();
        return id ? `${this.scheduling}/appointments/${id}` : undefined;
      }),
    );
  }

  historyResource(appointmentId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly AppointmentHistoryEntry[]>(
        () => {
          const id = appointmentId();
          return id ? `${this.scheduling}/appointments/${id}/history` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  create(body: CreateAppointmentInput): Promise<Appointment> {
    return firstValueFrom(
      this.http.post<Appointment>(`${this.scheduling}/appointments`, {
        ...body,
        createdByUserPublicId: body.createdByUserPublicId ?? this.userId(),
      }),
    );
  }

  /** Cambia el estado por la ruta que le corresponde. El destino se toma de
   *  `allowedTransitions`, así que aquí no hay que volver a validarlo. */
  changeStatus(
    appointmentId: string,
    target: StatusAction,
    body: StatusChangeInput = {},
  ): Promise<Appointment> {
    return firstValueFrom(
      this.http.post<Appointment>(
        `${this.scheduling}/appointments/${appointmentId}/${STATUS_ENDPOINT[target]}`,
        {
          origin: 'USER',
          ...body,
          userAccountPublicId: body.userAccountPublicId ?? this.userId(),
        },
      ),
    );
  }

  /** Devuelve la cita **nueva**: reprogramar no edita, sustituye. */
  reschedule(appointmentId: string, body: RescheduleInput): Promise<Appointment> {
    return firstValueFrom(
      this.http.post<Appointment>(`${this.scheduling}/appointments/${appointmentId}/reschedule`, {
        ...body,
        userAccountPublicId: body.userAccountPublicId ?? this.userId(),
      }),
    );
  }

  /* ---------------------------------------------------- disponibilidad -- */

  availabilitiesResource(professionalOrganizationId: Signal<string | null>, onlyActive = true) {
    return dataResource(
      httpResource<readonly Availability[]>(
        () => {
          const id = professionalOrganizationId();
          return id
            ? {
                url: `${this.scheduling}/availabilities`,
                params: { professionalOrganizationPublicId: id, onlyActive },
              }
            : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  /** Huecos libres del día. Devuelve `null` mientras falte algún dato para
   *  preguntar: sin profesional o sin fecha no hay pregunta que hacer. */
  slotsResource(query: {
    readonly professionalOrganizationId: Signal<string | null>;
    readonly professionalId: Signal<string | null>;
    readonly branchId: Signal<string | null>;
    readonly date: Signal<string | null>;
  }) {
    return dataResource(
      httpResource<DaySlots>(() => {
        const organizationPublicId = this.organizationId();
        const professionalOrganizationPublicId = query.professionalOrganizationId();
        const healthProfessionalPublicId = query.professionalId();
        const date = query.date();
        const branchPublicId = query.branchId();
        if (
          organizationPublicId === null ||
          professionalOrganizationPublicId === null ||
          healthProfessionalPublicId === null ||
          !date
        ) {
          return undefined;
        }
        return {
          url: `${this.scheduling}/availability/slots`,
          params: {
            organizationPublicId,
            professionalOrganizationPublicId,
            healthProfessionalPublicId,
            date,
            ...(branchPublicId ? { branchPublicId } : {}),
          },
        };
      }),
    );
  }

  createAvailability(body: CreateAvailabilityInput): Promise<Availability> {
    return firstValueFrom(this.http.post<Availability>(`${this.scheduling}/availabilities`, body));
  }

  deactivateAvailability(id: number): Promise<Availability> {
    return firstValueFrom(
      this.http.delete<Availability>(`${this.scheduling}/availabilities/${id}`),
    );
  }

  /* --------------------------------------------------------- bloqueos -- */

  blocksResource(range: Signal<Range | null>, professionalId?: Signal<string | null>) {
    return dataResource(
      httpResource<readonly ScheduleBlock[]>(
        () => {
          const organizationPublicId = this.organizationId();
          if (organizationPublicId === null) {
            return undefined;
          }
          const window = range();
          const professional = professionalId?.() ?? null;
          return {
            url: `${this.scheduling}/blocks`,
            params: {
              organizationPublicId,
              ...(window ? { from: window.from, to: window.to } : {}),
              ...(professional ? { healthProfessionalPublicId: professional } : {}),
            },
          };
        },
        { defaultValue: [] },
      ),
    );
  }

  createBlock(body: CreateBlockInput): Promise<ScheduleBlock> {
    return firstValueFrom(
      this.http.post<ScheduleBlock>(`${this.scheduling}/blocks`, {
        ...body,
        createdByUserPublicId: body.createdByUserPublicId ?? this.userId(),
      }),
    );
  }

  deleteBlock(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.scheduling}/blocks/${id}`));
  }

  /* --------------------------------------------------------- recursos -- */

  resourcesResource(filters?: {
    readonly branchId?: Signal<string | null>;
    readonly type?: Signal<string | null>;
    readonly status?: Signal<string | null>;
    readonly page?: Signal<number>;
  }) {
    return dataResource(
      httpResource<Page<PhysicalResource>>(() => {
        const organizationPublicId = this.organizationId();
        if (organizationPublicId === null) {
          return undefined;
        }
        const branch = filters?.branchId?.() ?? null;
        const type = filters?.type?.() ?? null;
        const status = filters?.status?.() ?? null;
        return {
          url: `${this.scheduling}/resources`,
          params: {
            organizationPublicId,
            size: 100,
            page: filters?.page?.() ?? 0,
            ...(branch ? { branchPublicId: branch } : {}),
            ...(type ? { type } : {}),
            ...(status ? { status } : {}),
          },
        };
      }),
    );
  }

  createResource(body: CreateResourceInput): Promise<PhysicalResource> {
    return firstValueFrom(this.http.post<PhysicalResource>(`${this.scheduling}/resources`, body));
  }

  updateResource(publicId: string, body: UpdateResourceInput): Promise<PhysicalResource> {
    return firstValueFrom(
      this.http.patch<PhysicalResource>(`${this.scheduling}/resources/${publicId}`, body),
    );
  }

  changeResourceStatus(publicId: string, status: ResourceStatus): Promise<PhysicalResource> {
    return firstValueFrom(
      this.http.patch<PhysicalResource>(`${this.scheduling}/resources/${publicId}/status`, {
        status,
      }),
    );
  }

  /* ------------------------------------------------------- ocupaciones -- */

  reservationsResource(range: Signal<Range | null>, resourceId?: Signal<string | null>) {
    return dataResource(
      httpResource<readonly ResourceReservation[]>(
        () => {
          const organizationPublicId = this.organizationId();
          if (organizationPublicId === null) {
            return undefined;
          }
          const window = range();
          const resource = resourceId?.() ?? null;
          return {
            url: `${this.scheduling}/reservations`,
            params: {
              organizationPublicId,
              ...(window ? { from: window.from, to: window.to } : {}),
              ...(resource ? { physicalResourcePublicId: resource } : {}),
            },
          };
        },
        { defaultValue: [] },
      ),
    );
  }

  releaseReservation(id: number): Promise<ResourceReservation> {
    return firstValueFrom(
      this.http.post<ResourceReservation>(`${this.scheduling}/reservations/${id}/release`, {}),
    );
  }
}
