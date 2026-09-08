/**
 * Máquinas de estado replicadas del backend.
 *
 * La interfaz solo ofrece transiciones válidas. Un destino imposible no se
 * muestra deshabilitado ni se muestra y falla: no se muestra. Así el usuario
 * nunca provoca un 422 por pulsar lo que la pantalla le ofrecía.
 *
 * Fuente exacta (no la documentación, que difería):
 *   services/ms-historial/.../domain/enums/{EncounterStatus,StudyOrderStatus,
 *   PrescriptionStatus}.java · método canTransitionTo.
 */

export type EncounterStatus = 'DRAFT' | 'SIGNED' | 'VOIDED';
export type StudyOrderStatus =
  'REQUESTED' | 'SCHEDULED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'REPORTED' | 'VOIDED';
export type PrescriptionStatus =
  'ISSUED' | 'PARTIALLY_DISPENSED' | 'DISPENSED' | 'EXPIRED' | 'VOIDED';
export type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'ATTENDED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED';
export type RecordStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
export type CampaignStatus =
  'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'CANCELLED';
export type AdvertisementStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'FINISHED';

/**
 * Fuente: ms-agenda · domain/AppointmentStatus.java · mapa TRANSITIONS.
 * Reprogramar no es un botón de estado: crea una cita nueva, por eso vive en su
 * propio formulario y no en la lista de transiciones que se ofrecen como acción.
 */
const APPOINTMENT: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['CONFIRMED', 'WAITING', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
  CONFIRMED: ['WAITING', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
  WAITING: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['ATTENDED', 'CANCELLED'],
  ATTENDED: [],
  CANCELLED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

/**
 * Fuente: ms-marketing · domain/enums/CampaignStatus.java y los métodos de
 * `Campaign` (schedule, launch, pause, finish, cancel).
 *
 * Lanzar exige además audiencia materializada; eso no es una transición sino una
 * precondición, y la vista la comprueba aparte con `canLaunch`.
 */
const CAMPAIGN: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['SCHEDULED', 'RUNNING', 'FINISHED', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'FINISHED', 'CANCELLED'],
  RUNNING: ['PAUSED', 'FINISHED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
};

/** Fuente: ms-marketing · `Advertisement`. Un anuncio finalizado no vuelve. */
const ADVERTISEMENT: Record<AdvertisementStatus, AdvertisementStatus[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['PAUSED', 'FINISHED'],
  PAUSED: ['PUBLISHED', 'FINISHED'],
  FINISHED: [],
};

const ENCOUNTER: Record<EncounterStatus, EncounterStatus[]> = {
  DRAFT: ['SIGNED', 'VOIDED'],
  SIGNED: ['VOIDED'],
  VOIDED: [],
};

const STUDY_ORDER: Record<StudyOrderStatus, StudyOrderStatus[]> = {
  REQUESTED: ['SCHEDULED', 'SAMPLE_COLLECTED', 'VOIDED'],
  SCHEDULED: ['SAMPLE_COLLECTED', 'IN_PROGRESS', 'VOIDED'],
  SAMPLE_COLLECTED: ['IN_PROGRESS', 'REPORTED', 'VOIDED'],
  IN_PROGRESS: ['REPORTED', 'VOIDED'],
  REPORTED: [],
  VOIDED: [],
};

const PRESCRIPTION: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  ISSUED: ['PARTIALLY_DISPENSED', 'DISPENSED', 'EXPIRED', 'VOIDED'],
  PARTIALLY_DISPENSED: ['DISPENSED', 'EXPIRED', 'VOIDED'],
  DISPENSED: [],
  EXPIRED: [],
  VOIDED: [],
};

export const appointmentTransitions = (from: AppointmentStatus) => APPOINTMENT[from] ?? [];

/** Una cita cerrada ya no ocupa la agenda ni admite cambios. */
export const isAppointmentClosed = (status: AppointmentStatus) =>
  appointmentTransitions(status).length === 0;

/** Recorrido normal de una cita atendida, para dibujar su línea de tiempo. */
export const APPOINTMENT_TIMELINE: AppointmentStatus[] = [
  'REQUESTED',
  'CONFIRMED',
  'WAITING',
  'IN_PROGRESS',
  'ATTENDED',
];

export const campaignTransitions = (from: CampaignStatus) => CAMPAIGN[from] ?? [];
export const advertisementTransitions = (from: AdvertisementStatus) => ADVERTISEMENT[from] ?? [];

/**
 * La audiencia solo se puede recalcular antes de que la campaña salga.
 * Fuente: `CampaignStatus#allowsAudienceRefresh`.
 */
export const allowsAudienceRefresh = (status: CampaignStatus) =>
  status === 'DRAFT' || status === 'SCHEDULED';

/** Una campaña terminada o cancelada ya no admite ninguna acción. */
export const isCampaignClosed = (status: CampaignStatus) =>
  campaignTransitions(status).length === 0;

export const encounterTransitions = (from: EncounterStatus) => ENCOUNTER[from] ?? [];
export const studyOrderTransitions = (from: StudyOrderStatus) => STUDY_ORDER[from] ?? [];
export const prescriptionTransitions = (from: PrescriptionStatus) => PRESCRIPTION[from] ?? [];

/** Un encuentro firmado es inmutable: se corrige con un addendum, no editándolo. */
export const isEncounterEditable = (status: EncounterStatus) => status === 'DRAFT';

/** Recorrido normal de una orden de estudio, para dibujar su línea de tiempo. */
export const STUDY_ORDER_TIMELINE: StudyOrderStatus[] = [
  'REQUESTED',
  'SCHEDULED',
  'SAMPLE_COLLECTED',
  'IN_PROGRESS',
  'REPORTED',
];

/** El backend admite resultados en cualquier estado salvo anulada. */
export const acceptsStudyResults = (status: StudyOrderStatus) => status !== 'VOIDED';

/* --------------------------------------------------------------------------
   Tono visual de cada estado. El color señala, y nunca va solo: cada chip
   lleva además su texto. Verde de marca = resuelto; naranja de marca =
   necesita atención; neutro = todavía sin cargar significado; rojo = anulado.
   -------------------------------------------------------------------------- */
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'err' | 'muted' | 'solid';

export const encounterTone: Record<EncounterStatus, Tone> = {
  DRAFT: 'warn',
  SIGNED: 'ok',
  VOIDED: 'muted',
};

export const studyOrderTone: Record<StudyOrderStatus, Tone> = {
  REQUESTED: 'neutral',
  SCHEDULED: 'brand',
  SAMPLE_COLLECTED: 'warn',
  IN_PROGRESS: 'warn',
  REPORTED: 'ok',
  VOIDED: 'muted',
};

export const prescriptionTone: Record<PrescriptionStatus, Tone> = {
  ISSUED: 'brand',
  PARTIALLY_DISPENSED: 'warn',
  DISPENSED: 'ok',
  EXPIRED: 'muted',
  VOIDED: 'muted',
};

export const recordTone: Record<RecordStatus, Tone> = {
  ACTIVE: 'ok',
  ARCHIVED: 'neutral',
  CLOSED: 'muted',
};

export const invoiceTone: Record<string, Tone> = {
  ISSUED: 'brand',
  SEND_PENDING: 'warn',
  DEMO_ACCEPTED: 'ok',
  VALIDATED: 'ok',
  REJECTED: 'err',
  VOIDED: 'muted',
};

/**
 * Marketing. Neutro = todavía se está preparando; azul de marca = programada,
 * lista para salir; verde intenso = saliendo ahora mismo; naranja = detenida a
 * mano; apagado = fuera de juego.
 */
export const campaignTone: Record<CampaignStatus, Tone> = {
  DRAFT: 'neutral',
  SCHEDULED: 'brand',
  RUNNING: 'solid',
  PAUSED: 'warn',
  FINISHED: 'ok',
  CANCELLED: 'muted',
};

export const advertisementTone: Record<AdvertisementStatus, Tone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'ok',
  PAUSED: 'warn',
  FINISHED: 'muted',
};

/**
 * Destinatarios. El excluido por opt-out no es un fallo del sistema —es una
 * decisión del paciente que se respetó— así que va en neutro apagado y no en
 * rojo: rojo se reserva para la entrega que falló de verdad.
 */
export const recipientTone: Record<string, Tone> = {
  SELECTED: 'neutral',
  EXCLUDED_OPT_OUT: 'muted',
  SENT: 'brand',
  READ: 'warn',
  CONVERTED: 'ok',
  FAILED: 'err',
};

export const loyaltyMovementTone: Record<string, Tone> = {
  ACCRUAL: 'ok',
  REFERRAL_BONUS: 'ok',
  REDEMPTION: 'brand',
  MANUAL_ADJUSTMENT: 'warn',
  EXPIRATION: 'muted',
};

export const genericTone: Record<string, Tone> = {
  ACTIVE: 'ok',
  INACTIVE: 'muted',
  ACTIVA: 'ok',
  ONBOARDING: 'warn',
  SUSPENDED: 'warn',
  CANCELLED: 'muted',
  TRIAL: 'warn',
  PAST_DUE: 'err',
  DECEASED: 'muted',
  MILD: 'neutral',
  MODERATE: 'warn',
  SEVERE: 'err',
  ANAPHYLAXIS: 'err',
  ROUTINE: 'neutral',
  URGENT: 'warn',
  STAT: 'err',
  PROVISIONAL: 'warn',
  FINAL: 'ok',
  DISMISSED: 'muted',
  RESOLVED: 'muted',
  AT_REMISSION: 'warn',
  PRELIMINARY: 'warn',
  CORRECTED: 'warn',
  SCHEDULED: 'brand',
  IN_PROGRESS: 'warn',
  COMPLETED: 'ok',
};

/**
 * Agenda. El tablero pinta muchas citas a la vez, así que el estado tiene que
 * distinguirse de un vistazo sin depender solo del color: cada bloque lleva
 * además el nombre del estado. Neutro = pedida y aún sin confirmar; naranja =
 * la persona ya está en el centro y alguien la espera; verde = en marcha o
 * resuelta; rojo = no vino; apagado = fuera de juego.
 */
export const appointmentTone: Record<AppointmentStatus, Tone> = {
  REQUESTED: 'neutral',
  CONFIRMED: 'brand',
  WAITING: 'warn',
  IN_PROGRESS: 'solid',
  ATTENDED: 'ok',
  NO_SHOW: 'err',
  CANCELLED: 'muted',
  RESCHEDULED: 'muted',
};

export const resourceTone: Record<string, Tone> = {
  AVAILABLE: 'ok',
  OCCUPIED: 'brand',
  UNDER_MAINTENANCE: 'warn',
  OUT_OF_SERVICE: 'err',
};

export const reservationTone: Record<string, Tone> = {
  RESERVED: 'brand',
  IN_USE: 'warn',
  RELEASED: 'muted',
  CANCELLED: 'muted',
};
