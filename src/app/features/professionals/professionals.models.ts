/**
 * ms-profesionales y el catálogo de especialidades de ms-catalogos.
 *
 * Los tipos reproducen los `record` de Java uno a uno. La agenda necesita de
 * aquí tres cosas: quién atiende, con qué especialidad se le presenta en el
 * tablero y cuál es su vínculo con la organización —el
 * `professionalOrganizationPublicId` que ms-agenda pide para calcular huecos—.
 */

export interface ProfessionalOrganizationLink {
  /** Este identificador es el `professionalOrganizationPublicId` de ms-agenda. */
  readonly id: string;
  readonly organizationId: string;
  readonly branchId: string | null;
  readonly modality: string;
  readonly status: 'ACTIVE' | 'INACTIVE' | string;
}

export interface ProfessionalSpecialty {
  readonly code: string;
  readonly primary: boolean;
  readonly graduationYear: number | null;
}

export interface Professional {
  readonly id: string;
  readonly fullName: string;
  readonly licenseNumber: string;
  readonly professionalType: string;
  readonly status: string;
  readonly specialties: readonly ProfessionalSpecialty[];
  readonly organizations: readonly ProfessionalOrganizationLink[];
}

export interface Specialty {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}
