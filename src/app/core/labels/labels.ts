/**
 * Todo el texto que el usuario lee para un valor del backend vive aquí, para
 * poder revisarlo de una sola pasada. Las claves son los enum reales de Java,
 * copiados de `domain/enums` de cada servicio.
 */

type Dict = Record<string, string>;

const dict = <T extends Dict>(entries: T) => entries;

/* ------------------------------------------------------------------ comunes */
export const DEPARTMENT: Dict = dict({
  LA_PAZ: 'La Paz',
  COCHABAMBA: 'Cochabamba',
  SANTA_CRUZ: 'Santa Cruz',
  ORURO: 'Oruro',
  POTOSI: 'Potosí',
  CHUQUISACA: 'Chuquisaca',
  TARIJA: 'Tarija',
  BENI: 'Beni',
  PANDO: 'Pando',
  FOREIGN: 'Extranjero',
});

export const ROLE: Dict = dict({
  PLATFORM_ADMIN: 'Administrador de plataforma',
  ADMINISTRATOR: 'Administración',
  PHYSICIAN: 'Profesional de salud',
  RECEPTIONIST: 'Recepción',
  BILLING_CLERK: 'Facturación',
  PATIENT: 'Paciente',
});

/* --------------------------------------------------------------- pacientes */
export const DOCUMENT_TYPE: Dict = dict({
  CI: 'Cédula de identidad',
  FOREIGN_ID_CARD: 'Carnet de extranjería',
  PASSPORT: 'Pasaporte',
  BIRTH_CERTIFICATE: 'Certificado de nacimiento',
  NO_DOCUMENT: 'Sin documento',
});
export const DOCUMENT_TYPE_SHORT: Dict = dict({
  CI: 'CI',
  FOREIGN_ID_CARD: 'CE',
  PASSPORT: 'Pasaporte',
  BIRTH_CERTIFICATE: 'Cert. nac.',
  NO_DOCUMENT: 'S/D',
});
export const SEX: Dict = dict({
  M: 'Masculino',
  F: 'Femenino',
  INTERSEX: 'Intersexual',
  UNDECLARED: 'No declarado',
});
export const PATIENT_STATUS: Dict = dict({
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DECEASED: 'Fallecido',
});

/* ---------------------------------------------------------------- tenencia */
export const ORGANIZATION_TYPE: Dict = dict({
  PRIVATE_CLINIC: 'Clínica privada',
  PUBLIC_CLINIC: 'Clínica pública',
  OFFICE: 'Consultorio',
  INDEPENDENT_PHYSICIAN: 'Profesional independiente',
  DIAGNOSTIC_CENTER: 'Centro de diagnóstico',
});
export const ORGANIZATION_STATUS: Dict = dict({
  ONBOARDING: 'En alta',
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
});
export const BRANCH_STATUS: Dict = dict({ ACTIVE: 'Activa', INACTIVE: 'Inactiva' });
export const SERVICE_OFFERING_TYPE: Dict = dict({
  CONSULTATION: 'Consulta',
  FOLLOW_UP: 'Control',
  PROCEDURE: 'Procedimiento',
  SURGERY: 'Cirugía',
  STUDY: 'Estudio',
  TELECONSULTATION: 'Teleconsulta',
  VACCINATION: 'Vacunación',
  OTHER: 'Otra',
});
export const REQUIRED_RESOURCE_TYPE: Dict = dict({
  NONE: 'No requiere',
  OFFICE: 'Consultorio',
  OPERATING_ROOM: 'Quirófano',
  PROCEDURE_ROOM: 'Sala de procedimientos',
  EQUIPMENT: 'Equipo',
});
export const SUBSCRIPTION_STATUS: Dict = dict({
  TRIAL: 'En prueba',
  ACTIVE: 'Vigente',
  PAST_DUE: 'Con pago pendiente',
  CANCELLED: 'Cancelada',
});
export const BILLING_CYCLE: Dict = dict({ MONTHLY: 'Mensual', YEARLY: 'Anual' });
export const USAGE_METRIC: Dict = dict({
  USERS: 'Usuarios',
  BRANCHES: 'Sucursales',
  STORAGE_BYTES: 'Almacenamiento',
});

/* --------------------------------------------------------------- historial */
export const RECORD_STATUS: Dict = dict({
  ACTIVE: 'Activo',
  ARCHIVED: 'Archivado',
  CLOSED: 'Cerrado',
});
export const ENCOUNTER_STATUS: Dict = dict({
  DRAFT: 'Borrador',
  SIGNED: 'Firmado',
  VOIDED: 'Anulado',
});
export const ENCOUNTER_TYPE: Dict = dict({
  INITIAL_CONSULTATION: 'Primera consulta',
  FOLLOW_UP_CONSULTATION: 'Consulta de control',
  EMERGENCY: 'Urgencia',
  TELECONSULTATION: 'Teleconsulta',
  PROCEDURE: 'Procedimiento',
  SURGERY: 'Cirugía',
  CONSULTATION_REFERRAL: 'Interconsulta',
});
export const DIAGNOSIS_TYPE: Dict = dict({
  PROVISIONAL: 'Presuntivo',
  FINAL: 'Definitivo',
  DISMISSED: 'Descartado',
});
export const DIAGNOSIS_STATUS: Dict = dict({
  ACTIVE: 'Activo',
  AT_REMISSION: 'En remisión',
  RESOLVED: 'Resuelto',
});
export const LATERALITY: Dict = dict({
  NOT_APPLICABLE: 'No aplica',
  LEFT: 'Izquierda',
  RIGHT: 'Derecha',
  BILATERAL: 'Bilateral',
});
export const ALLERGY_TYPE: Dict = dict({
  MEDICATION: 'Medicamento',
  FOOD: 'Alimento',
  ENVIRONMENTAL: 'Ambiental',
  LATEX: 'Látex',
  STING: 'Picadura',
  OTHER: 'Otra',
});
export const ALLERGY_SEVERITY: Dict = dict({
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Grave',
  ANAPHYLAXIS: 'Anafilaxia',
});
export const ALLERGY_STATUS: Dict = dict({
  ACTIVE: 'Activa',
  RESOLVED: 'Resuelta',
  DISMISSED: 'Descartada',
});
export const BACKGROUND_TYPE: Dict = dict({
  PATHOLOGICAL: 'Patológico',
  FAMILY: 'Familiar',
  SURGICAL: 'Quirúrgico',
  TRAUMATIC: 'Traumático',
  HABIT: 'Hábito',
  OBSTETRIC_GYNECOLOGICAL: 'Gineco-obstétrico',
  IMMUNIZATION: 'Inmunización',
  TRANSFUSIONAL: 'Transfusional',
  OTHER: 'Otro',
});
export const ADMINISTRATION_ROUTE: Dict = dict({
  ORAL: 'Oral',
  INTRAVENOUS: 'Intravenosa',
  INTRAMUSCULAR: 'Intramuscular',
  SUBCUTANEOUS: 'Subcutánea',
  TOPICAL: 'Tópica',
  OPHTHALMIC: 'Oftálmica',
  OTIC: 'Ótica',
  NASAL: 'Nasal',
  RECTAL: 'Rectal',
  INHALATION: 'Inhalatoria',
  OTHER: 'Otra',
});
export const PRESCRIPTION_STATUS: Dict = dict({
  ISSUED: 'Emitida',
  PARTIALLY_DISPENSED: 'Dispensada en parte',
  DISPENSED: 'Dispensada',
  EXPIRED: 'Vencida',
  VOIDED: 'Anulada',
});
export const STUDY_ORDER_STATUS: Dict = dict({
  REQUESTED: 'Solicitada',
  SCHEDULED: 'Agendada',
  SAMPLE_COLLECTED: 'Muestra tomada',
  IN_PROGRESS: 'En proceso',
  REPORTED: 'Con resultado',
  VOIDED: 'Anulada',
});
export const STUDY_PRIORITY: Dict = dict({
  ROUTINE: 'Rutina',
  URGENT: 'Urgente',
  STAT: 'Inmediata',
});
export const STUDY_RESULT_STATUS: Dict = dict({
  PRELIMINARY: 'Preliminar',
  FINAL: 'Definitivo',
  CORRECTED: 'Corregido',
});
export const PROCEDURE_STATUS: Dict = dict({
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  SUSPENDED: 'Suspendido',
});
export const ANESTHESIA_TYPE: Dict = dict({
  NONE: 'Sin anestesia',
  LOCAL: 'Local',
  REGIONAL: 'Regional',
  SEDATION: 'Sedación',
  GENERAL: 'General',
});
export const ADDENDUM_REASON: Dict = dict({
  CORRECTION: 'Corrección',
  ADDITION: 'Ampliación',
  LATE_RESULT: 'Resultado tardío',
  OTHER: 'Otro motivo',
});

/* ------------------------------------------------------------- facturación */
export const INVOICE_STATUS: Dict = dict({
  ISSUED: 'Emitida',
  SEND_PENDING: 'Pendiente de envío',
  DEMO_ACCEPTED: 'Aceptada (demostración)',
  VALIDATED: 'Validada',
  REJECTED: 'Rechazada',
  VOIDED: 'Anulada',
});
export const TAX_DOCUMENT_TYPE: Dict = dict({
  PURCHASE_SALE_INVOICE: 'Factura de compra-venta',
  HEALTH_SECTOR_INVOICE: 'Factura del sector salud',
  PROFESSIONAL_FEES_RECEIPT: 'Recibo de honorarios profesionales',
});
export const EMISSION_TYPE: Dict = dict({
  ONLINE: 'En línea',
  OFFLINE: 'Fuera de línea',
  BULK: 'Masiva',
});
export const PAYMENT_METHOD: Dict = dict({
  '1': 'Efectivo',
  '2': 'Tarjeta',
  '7': 'Transferencia bancaria',
  '8': 'Cheque',
});

/* ---------------------------------------------------------- profesionales */
/* Copiados de `ms-profesionales/domain/*.java`. Dos avisos para quien los lea
   esperando otra cosa: el estado del vínculo es ACTIVE | SUSPENDED | ENDED —no
   existe INACTIVE— y la modalidad describe la relación contractual con el
   centro, no si la atención es presencial o remota; esa otra modalidad es
   `MODALITY`, de ms-agenda. */
export const PROFESSIONAL_TYPE: Dict = dict({
  PHYSICIAN: 'Médico',
  DENTIST: 'Odontólogo',
  PSYCHOLOGIST: 'Psicólogo',
  NUTRITIONIST: 'Nutricionista',
  PHYSIOTHERAPIST: 'Fisioterapeuta',
  NURSING: 'Enfermería',
  BIOCHEMIST: 'Bioquímico',
  OTHER: 'Otro',
});
export const PROFESSIONAL_STATUS: Dict = dict({
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  INACTIVE: 'Inactivo',
});
export const PROFESSIONAL_LINK_STATUS: Dict = dict({
  ACTIVE: 'Vigente',
  SUSPENDED: 'Suspendido',
  ENDED: 'Terminado',
});
export const WORK_MODALITY: Dict = dict({
  STAFF: 'De planta',
  EXTERNAL_CONSULTANT: 'Consultor externo',
  FEE_BASED: 'Por honorarios',
  PARTNER: 'Socio',
});

/* ------------------------------------------------------------------ agenda */
export const APPOINTMENT_STATUS: Dict = dict({
  REQUESTED: 'Programada',
  CONFIRMED: 'Confirmada',
  WAITING: 'En sala',
  IN_PROGRESS: 'En curso',
  ATTENDED: 'Completada',
  NO_SHOW: 'No asistió',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
});
export const MODALITY: Dict = dict({
  IN_PERSON: 'Presencial',
  TELECONSULTATION: 'Teleconsulta',
});
export const AVAILABILITY_MODALITY: Dict = dict({
  IN_PERSON: 'Presencial',
  TELECONSULTATION: 'Teleconsulta',
  BOTH: 'Presencial y teleconsulta',
});
export const CHANNEL_ORIGIN: Dict = dict({
  RECEPTION: 'Mostrador',
  PHONE: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  WEB_PORTAL: 'Portal web',
  MOBILE_APP: 'Aplicación móvil',
});
export const STATUS_CHANGE_ORIGIN: Dict = dict({
  USER: 'Personal del centro',
  PATIENT: 'Paciente',
  SYSTEM: 'Sistema',
  WHATSAPP: 'WhatsApp',
});
export const BLOCK_TYPE: Dict = dict({
  VACATION: 'Vacaciones',
  HOLIDAY: 'Feriado',
  TRAINING: 'Capacitación',
  MAINTENANCE: 'Mantenimiento',
  EMERGENCY: 'Emergencia',
  CONFERENCE: 'Congreso',
  OTHER: 'Otro motivo',
});
export const RESOURCE_TYPE: Dict = dict({
  OFFICE: 'Consultorio',
  OPERATING_ROOM: 'Quirófano',
  PROCEDURE_ROOM: 'Sala de procedimientos',
  RECOVERY_ROOM: 'Sala de recuperación',
  IMAGING_EQUIPMENT: 'Equipo de imagen',
  LABORATORY: 'Laboratorio',
  WAITING_ROOM: 'Sala de espera',
});
export const RESOURCE_STATUS: Dict = dict({
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupado',
  UNDER_MAINTENANCE: 'En mantenimiento',
  OUT_OF_SERVICE: 'Fuera de servicio',
});
export const RESERVATION_STATUS: Dict = dict({
  RESERVED: 'Reservado',
  IN_USE: 'En uso',
  RELEASED: 'Liberado',
  CANCELLED: 'Cancelada',
});
/** Los días de la semana viajan como 1..7 (ISO-8601), lunes primero. */
export const WEEKDAY: Dict = dict({
  '1': 'Lunes',
  '2': 'Martes',
  '3': 'Miércoles',
  '4': 'Jueves',
  '5': 'Viernes',
  '6': 'Sábado',
  '7': 'Domingo',
});
export const WEEKDAY_SHORT: Dict = dict({
  '1': 'Lun',
  '2': 'Mar',
  '3': 'Mié',
  '4': 'Jue',
  '5': 'Vie',
  '6': 'Sáb',
  '7': 'Dom',
});

/** Traduce un valor de enum; si el backend añade uno nuevo, se muestra tal cual
 *  en vez de dejar la celda vacía. Un valor sin traducir es visible, no invisible. */
export function label(dictionary: Dict, value?: string | null, fallback = '—') {
  if (!value) return fallback;
  return dictionary[value] ?? value;
}

/** Convierte un diccionario en opciones de <select>, en el orden declarado. */
export function options(dictionary: Dict) {
  return Object.entries(dictionary).map(([value, text]) => ({ value, label: text }));
}
