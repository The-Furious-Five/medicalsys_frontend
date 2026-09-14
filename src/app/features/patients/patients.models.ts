/**
 * ms-pacientes · `/api/v1/patients`.
 *
 * Servicio de apoyo: historial y facturación referencian al paciente solo por
 * UUID, así que esta interfaz lo consulta para poder mostrar un nombre en vez
 * de un identificador.
 */
export interface Patient {
  readonly patientId: string;
  readonly userAccountId: string | null;
  readonly documentType: string;
  readonly documentNumber: string;
  readonly documentComplement: string | null;
  readonly givenNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname: string | null;
  readonly fullName: string;
  readonly birthDate: string;
  readonly sex: string | null;
  readonly phoneE164: string | null;
  readonly alternatePhone: string | null;
  readonly email: string | null;
  readonly city: string | null;
  readonly department: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly emergencyContactRelationship: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'DECEASED';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegisterPatientInput {
  readonly documentType: string;
  readonly documentNumber: string;
  readonly documentComplement: string | null;
  readonly givenNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname: string | null;
  readonly birthDate: string;
  readonly sex: string | null;
  readonly phoneE164: string | null;
  readonly email: string | null;
  readonly city: string | null;
  readonly department: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
}
