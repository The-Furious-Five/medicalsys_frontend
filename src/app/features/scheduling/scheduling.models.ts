import { AppointmentStatus } from '../../core/state/state-machines';

/**
 * ms-agenda · contratos de `/api/v1/scheduling/**`.
 *
 * Los tipos reproducen los `record` de Java uno a uno. Nada se inventa: si un
 * campo no está aquí, es que el backend no lo devuelve.
 */

export type Modality = 'IN_PERSON' | 'TELECONSULTATION';
export type AvailabilityModality = Modality | 'BOTH';
export type ChannelOrigin = 'WEB_PORTAL' | 'MOBILE_APP' | 'RECEPTION' | 'PHONE' | 'WHATSAPP';
export type StatusChangeOrigin = 'USER' | 'PATIENT' | 'SYSTEM' | 'WHATSAPP';
export type BlockType =
  'VACATION' | 'HOLIDAY' | 'TRAINING' | 'MAINTENANCE' | 'EMERGENCY' | 'CONFERENCE' | 'OTHER';
export type ResourceType =
  | 'OFFICE'
  | 'OPERATING_ROOM'
  | 'PROCEDURE_ROOM'
  | 'RECOVERY_ROOM'
  | 'IMAGING_EQUIPMENT'
  | 'LABORATORY'
  | 'WAITING_ROOM';
export type ResourceStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE';
export type ReservationStatus = 'RESERVED' | 'IN_USE' | 'RELEASED' | 'CANCELLED';

export interface Appointment {
  readonly publicId: string;
  readonly organizationPublicId: string;
  readonly branchPublicId: string;
  readonly patientPublicId: string;
  readonly healthProfessionalPublicId: string;
  readonly serviceOfferingPublicId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly modality: Modality;
  readonly status: AppointmentStatus;
  /** Lo que el backend admite ahora mismo: la interfaz no ofrece nada más. */
  readonly allowedTransitions: readonly AppointmentStatus[];
  readonly channelOrigin: ChannelOrigin;
  readonly reasonForVisit: string | null;
  readonly requiresConsent: boolean;
  readonly estimatedPriceBob: string | null;
  readonly teleconsultationLink: string | null;
  readonly sourceAppointmentPublicId: string | null;
  readonly createdByUserPublicId: string | null;
  readonly confirmedAt: string | null;
  readonly arrivedAt: string | null;
  readonly careStartedAt: string | null;
  readonly careEndedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancelledByUserPublicId: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppointmentHistoryEntry {
  readonly id: number;
  readonly previousStatus: AppointmentStatus | null;
  readonly newStatus: AppointmentStatus;
  readonly reason: string | null;
  readonly userAccountPublicId: string | null;
  readonly origin: StatusChangeOrigin | null;
  readonly occurredAt: string;
}

export interface Availability {
  readonly id: number;
  readonly professionalOrganizationPublicId: string;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotDurationMinutes: number;
  readonly simultaneousCapacity: number;
  readonly modality: AvailabilityModality;
  readonly preferredResourcePublicId: string | null;
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly active: boolean;
}

export interface Slot {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly modality: AvailabilityModality;
  readonly remainingCapacity: number;
}

export interface DaySlots {
  readonly date: string;
  readonly professionalOrganizationPublicId: string;
  readonly healthProfessionalPublicId: string;
  readonly totalSlots: number;
  readonly slots: readonly Slot[];
}

export interface ScheduleBlock {
  readonly id: number;
  readonly organizationPublicId: string;
  readonly healthProfessionalPublicId: string | null;
  readonly physicalResourcePublicId: string | null;
  readonly branchPublicId: string | null;
  readonly type: BlockType;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string | null;
  readonly createdByUserPublicId: string | null;
  readonly createdAt: string;
}

export interface PhysicalResource {
  readonly publicId: string;
  readonly organizationPublicId: string;
  readonly branchPublicId: string;
  readonly code: string;
  readonly name: string;
  readonly type: ResourceType;
  readonly floor: string | null;
  readonly peopleCapacity: number | null;
  readonly preparationMinutes: number | null;
  readonly requiresSterilization: boolean;
  readonly equipment: string | null;
  readonly status: ResourceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceReservation {
  readonly id: number;
  readonly organizationPublicId: string;
  readonly physicalResourcePublicId: string;
  readonly physicalResourceCode: string | null;
  readonly appointmentPublicId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly purpose: string | null;
  readonly status: ReservationStatus;
  readonly createdByUserPublicId: string | null;
  readonly createdAt: string;
}

/* ---------------------------------------------------------------- entradas */

export interface CreateAppointmentInput {
  readonly organizationPublicId: string;
  readonly branchPublicId: string;
  readonly patientPublicId: string;
  readonly healthProfessionalPublicId: string;
  readonly serviceOfferingPublicId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly modality?: Modality;
  readonly channelOrigin?: ChannelOrigin;
  readonly reasonForVisit?: string | null;
  readonly requiresConsent?: boolean;
  readonly estimatedPriceBob?: string | null;
  readonly teleconsultationLink?: string | null;
  readonly physicalResourcePublicId?: string | null;
  readonly createdByUserPublicId?: string | null;
}

export interface RescheduleInput {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly healthProfessionalPublicId?: string | null;
  readonly physicalResourcePublicId?: string | null;
  readonly reason?: string | null;
  readonly userAccountPublicId?: string | null;
}

export interface StatusChangeInput {
  readonly reason?: string | null;
  readonly userAccountPublicId?: string | null;
  readonly origin?: StatusChangeOrigin;
}

export interface CreateAvailabilityInput {
  readonly professionalOrganizationPublicId: string;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotDurationMinutes: number;
  readonly simultaneousCapacity: number;
  readonly modality: AvailabilityModality;
  readonly preferredResourcePublicId?: string | null;
  readonly validFrom: string;
  readonly validUntil?: string | null;
}

export interface CreateBlockInput {
  readonly organizationPublicId: string;
  readonly healthProfessionalPublicId?: string | null;
  readonly physicalResourcePublicId?: string | null;
  readonly branchPublicId?: string | null;
  readonly type: BlockType;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason?: string | null;
  readonly createdByUserPublicId?: string | null;
}

export interface CreateResourceInput {
  readonly organizationPublicId: string;
  readonly branchPublicId: string;
  readonly code: string;
  readonly name: string;
  readonly type: ResourceType;
  readonly floor?: string | null;
  readonly peopleCapacity?: number | null;
  readonly preparationMinutes?: number | null;
  readonly requiresSterilization?: boolean;
  readonly equipment?: string | null;
}

export interface UpdateResourceInput {
  readonly name?: string;
  readonly type?: ResourceType;
  readonly floor?: string | null;
  readonly peopleCapacity?: number | null;
  readonly preparationMinutes?: number | null;
  readonly requiresSterilization?: boolean;
  readonly equipment?: string | null;
}
