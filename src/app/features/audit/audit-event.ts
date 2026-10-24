/**
 * Modelos del contrato público de ms-auditoria (`/api/v1/audit/**`).
 *
 * Reproducen exactamente lo que publica el productor. No se agrega ningún envoltorio `data` ni se
 * renombra un campo por comodidad de la vista: cuando el modelo se aparta del contrato, el error
 * aparece en runtime y lejos de su causa.
 */

/** Área funcional del evento. Es el filtro que sobrevive al crecimiento del catálogo de acciones. */
export type AuditCategory =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'PATIENT_DATA'
  | 'CLINICAL_RECORD'
  | 'DOCUMENT'
  | 'SCHEDULING'
  | 'BILLING'
  | 'CONFIGURATION'
  | 'SECURITY'
  | 'SYSTEM';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

export type AuditSeverity = 'INFO' | 'NOTICE' | 'WARNING' | 'CRITICAL';

export interface AuditEvent {
  readonly eventId: string;
  readonly organizationId: string;
  readonly sequenceNumber: number;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly serviceName: string;
  readonly action: string;
  readonly category: AuditCategory;
  readonly severity: AuditSeverity;
  readonly outcome: AuditOutcome;
  readonly actorUserId?: string;
  readonly actorDisplayName?: string;
  readonly actorRoles: readonly string[];
  readonly actorIp?: string;
  readonly resourceType: string;
  readonly resourcePublicId?: string;
  readonly resourceLabel?: string;
  readonly patientPublicId?: string;
  readonly correlationId: string;
  readonly requestMethod?: string;
  readonly requestPath?: string;
  readonly responseStatus?: number;
  readonly reason?: string;
  /** Contexto adicional serializado por el productor; llega como texto JSON, no como objeto. */
  readonly metadata?: string;
  readonly previousHash?: string;
  readonly recordHash: string;
}

export interface AuditPage {
  readonly content: readonly AuditEvent[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface AuditCountByKey {
  readonly key: string;
  readonly total: number;
}

export interface AuditActorActivity {
  readonly actorUserId: string;
  readonly actorDisplayName?: string;
  readonly total: number;
}

export interface AuditSummary {
  readonly from: string;
  readonly to: string;
  readonly totalEvents: number;
  readonly deniedEvents: number;
  readonly failedEvents: number;
  readonly criticalEvents: number;
  readonly byCategory: readonly AuditCountByKey[];
  readonly byOutcome: readonly AuditCountByKey[];
  readonly bySeverity: readonly AuditCountByKey[];
  readonly byService: readonly AuditCountByKey[];
  readonly topActors: readonly AuditActorActivity[];
}

/** Resultado de recalcular la cadena de hashes de un tramo de la bitácora. */
export interface AuditIntegrity {
  readonly fromSequenceNumber: number;
  readonly toSequenceNumber: number;
  readonly verifiedEvents: number;
  readonly intact: boolean;
  readonly brokenAtSequenceNumber?: number;
  readonly brokenEventId?: string;
  readonly detail: string;
  readonly verifiedAt: string;
}

/**
 * Criterios de búsqueda enviados al backend.
 *
 * La organización sale del JWT y el gateway la propaga. `organizationId` solo lo respeta el backend
 * con alcance de plataforma (OSI, `audit.log.read_platform`); a cualquier otro le responde 403.
 */
export interface AuditFilters {
  readonly organizationId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly category?: AuditCategory;
  readonly outcome?: AuditOutcome;
  readonly severity?: AuditSeverity;
  readonly serviceName?: string;
  readonly action?: string;
  readonly resourceType?: string;
  readonly actorUserId?: string;
  readonly patientId?: string;
  readonly resourceId?: string;
  readonly correlationId?: string;
  readonly q?: string;
}

export const AUDIT_CATEGORIES: readonly AuditCategory[] = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'PATIENT_DATA',
  'CLINICAL_RECORD',
  'DOCUMENT',
  'SCHEDULING',
  'BILLING',
  'CONFIGURATION',
  'SECURITY',
  'SYSTEM',
];

export const AUDIT_OUTCOMES: readonly AuditOutcome[] = ['SUCCESS', 'DENIED', 'FAILURE'];

export const AUDIT_SEVERITIES: readonly AuditSeverity[] = ['INFO', 'NOTICE', 'WARNING', 'CRITICAL'];

/**
 * Etiquetas en español para códigos estables.
 *
 * El código es el dato; la etiqueta es presentación. Se traduce en un único lugar para que una
 * categoría nueva del backend aparezca con su código crudo en vez de romper la pantalla.
 */
const CATEGORY_LABELS: Readonly<Record<AuditCategory, string>> = {
  AUTHENTICATION: 'Autenticación',
  AUTHORIZATION: 'Autorización',
  PATIENT_DATA: 'Datos de paciente',
  CLINICAL_RECORD: 'Historia clínica',
  DOCUMENT: 'Documentos',
  SCHEDULING: 'Agenda',
  BILLING: 'Facturación',
  CONFIGURATION: 'Configuración',
  SECURITY: 'Seguridad',
  SYSTEM: 'Sistema',
};

const OUTCOME_LABELS: Readonly<Record<AuditOutcome, string>> = {
  SUCCESS: 'Completada',
  DENIED: 'Denegada',
  FAILURE: 'Con error',
};

const SEVERITY_LABELS: Readonly<Record<AuditSeverity, string>> = {
  INFO: 'Informativo',
  NOTICE: 'Relevante',
  WARNING: 'Advertencia',
  CRITICAL: 'Crítico',
};

export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code as AuditCategory] ?? code;
}

export function outcomeLabel(code: string): string {
  return OUTCOME_LABELS[code as AuditOutcome] ?? code;
}

export function severityLabel(code: string): string {
  return SEVERITY_LABELS[code as AuditSeverity] ?? code;
}
