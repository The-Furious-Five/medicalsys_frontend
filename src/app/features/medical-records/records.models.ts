/**
 * ms-historial · `/api/v1/{expedientes,encuentros,ordenes-estudio,recetas,
 * diagnosticos,alergias,antecedentes}`.
 *
 * Nota de contrato: el gateway enruta todos estos prefijos al mismo servicio.
 * No existe un prefijo `/medical-records` salvo para el ping.
 */
import {
  EncounterStatus,
  PrescriptionStatus,
  RecordStatus,
  StudyOrderStatus,
} from '../../core/state/state-machines';

export interface MedicalRecord {
  readonly id: string;
  readonly patientId: string;
  readonly recordNumber: string;
  readonly openedOn: string;
  readonly openingBranchId: string | null;
  readonly status: RecordStatus;
  readonly sharesWithNetwork: boolean;
  readonly sharingAuthorizedAt: string | null;
  readonly retentionUntil: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Narrative {
  readonly chiefComplaint: string | null;
  readonly subjective: string | null;
  readonly objective: string | null;
  readonly assessment: string | null;
  readonly plan: string | null;
}

export interface Diagnosis {
  readonly id: number;
  readonly icd10Code: string;
  readonly type: 'PROVISIONAL' | 'FINAL' | 'DISMISSED';
  readonly primary: boolean;
  readonly chronic: boolean;
  readonly laterality: string | null;
  readonly observation: string | null;
  readonly status: 'ACTIVE' | 'AT_REMISSION' | 'RESOLVED';
  readonly createdAt: string;
}

export interface Encounter {
  readonly id: string;
  readonly medicalRecordId: string;
  readonly patientId: string;
  readonly appointmentId: string | null;
  readonly professionalId: string;
  readonly branchId: string;
  readonly type: string;
  readonly status: EncounterStatus;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly suggestedNextAppointmentAt: string | null;
  readonly narrative: Narrative | null;
  readonly encrypted: boolean;
  readonly encryptionKeyId: string | null;
  readonly contentHash: string | null;
  readonly signedAt: string | null;
  readonly voidedAt: string | null;
  readonly cancellationReason: string | null;
  readonly diagnoses: readonly Diagnosis[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EncounterSummary {
  readonly id: string;
  readonly medicalRecordId: string;
  readonly patientId: string;
  readonly appointmentId: string | null;
  readonly professionalId: string;
  readonly type: string;
  readonly status: EncounterStatus;
  readonly startsAt: string;
  readonly endsAt: string | null;
}

export interface Addendum {
  readonly id: number;
  readonly professionalId: string;
  readonly reason: string;
  readonly text: string;
  readonly contentHash: string | null;
  readonly createdAt: string;
}

export interface VitalSign {
  readonly id: number;
  readonly measuredAt: string;
  readonly systolicPressure: number | null;
  readonly diastolicPressure: number | null;
  readonly heartRate: number | null;
  readonly respiratoryRate: number | null;
  readonly temperatureC: string | null;
  readonly oxygenSaturation: number | null;
  readonly bloodGlucoseMgDl: number | null;
  readonly weightKg: string | null;
  readonly heightCm: string | null;
  readonly bmi: string | null;
  readonly abdominalCircumferenceCm: string | null;
  readonly painScale: number | null;
  readonly recordedById: string | null;
}

export interface Allergy {
  readonly id: number;
  readonly type: string;
  readonly substance: string;
  readonly medicationCode: string | null;
  readonly reaction: string | null;
  readonly severity: string | null;
  readonly status: 'ACTIVE' | 'RESOLVED' | 'DISMISSED';
  readonly recordedById: string | null;
  readonly recordedAt: string;
}

export interface Background {
  readonly id: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string | null;
  readonly icd10Code: string | null;
  readonly eventDate: string | null;
  readonly active: boolean;
  readonly recordedById: string | null;
  readonly recordedAt: string;
}

export interface PrescriptionItem {
  readonly itemNumber: number;
  readonly medicationCode: string | null;
  readonly freeTextDescription: string | null;
  readonly dose: string;
  readonly administrationRoute: string | null;
  readonly frequencyHours: number | null;
  readonly durationDays: number | null;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly instructions: string | null;
}

export interface Prescription {
  readonly id: string;
  readonly encounterId: string;
  readonly folio: string;
  readonly issuedAt: string;
  readonly validityDays: number | null;
  readonly generalInstructions: string | null;
  readonly status: PrescriptionStatus;
  readonly documentId: string | null;
  readonly sha256Hash: string | null;
  readonly signedAt: string | null;
  readonly items: readonly PrescriptionItem[];
}

export interface StudyResult {
  readonly id: number;
  readonly parameter: string;
  readonly numericValue: string | null;
  readonly textValue: string | null;
  readonly unit: string | null;
  readonly referenceMin: string | null;
  readonly referenceMax: string | null;
  readonly outOfRange: boolean;
  readonly status: string;
  readonly documentId: string | null;
  readonly reportedById: string | null;
  readonly reportedAt: string;
  readonly deliveredToPatientAt: string | null;
}

export interface StudyOrder {
  readonly id: string;
  readonly encounterId: string;
  readonly medicalRecordId: string;
  readonly patientId: string;
  readonly studyTypeCode: string;
  readonly priority: string;
  readonly instructions: string | null;
  readonly icd10Code: string | null;
  readonly status: StudyOrderStatus;
  readonly requestedById: string | null;
  readonly requestedAt: string;
  readonly collectionAppointmentId: string | null;
  readonly results: readonly StudyResult[];
}
