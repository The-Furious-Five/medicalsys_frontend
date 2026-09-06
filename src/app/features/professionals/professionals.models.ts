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
/* ---------------------------------------------------------------------------
   Extensión del módulo de profesionales: directorio, alta y ficha.

   Los valores de los enum salen de `ms-profesionales/domain/*.java` leídos en
   el repositorio de la plataforma, no de la documentación. Dos de ellos no
   coinciden con lo que se supuso al planificar la pantalla, y conviene saberlo
   antes de leer el resto del módulo:

     · `OrganizationStatus` es ACTIVE | SUSPENDED | ENDED. No existe INACTIVE.
     · `OrganizationModality` es STAFF | EXTERNAL_CONSULTANT | FEE_BASED |
       PARTNER, y el servicio la rellena con FEE_BASED cuando llega vacía.
   --------------------------------------------------------------------------- */

/** `ms-profesionales/domain/ProfessionalType.java`. */
export type ProfessionalTypeCode =
  | 'PHYSICIAN'
  | 'DENTIST'
  | 'PSYCHOLOGIST'
  | 'NUTRITIONIST'
  | 'PHYSIOTHERAPIST'
  | 'NURSING'
  | 'BIOCHEMIST'
  | 'OTHER';

/** `ms-profesionales/domain/ProfessionalStatus.java`. */
export type ProfessionalStatusCode = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

/** `ms-profesionales/domain/OrganizationStatus.java`, el estado del vínculo. */
export type ProfessionalLinkStatus = 'ACTIVE' | 'SUSPENDED' | 'ENDED';

/** `ms-profesionales/domain/OrganizationModality.java`. */
export type WorkModality = 'STAFF' | 'EXTERNAL_CONSULTANT' | 'FEE_BASED' | 'PARTNER';

/** `ms-profesionales/domain/DocumentType.java`: es más corto que el de pacientes. */
export type ProfessionalDocumentType = 'CI' | 'FOREIGN_ID_CARD' | 'PASSPORT';

/**
 * Vínculo tal como lo necesita la ficha.
 *
 * TODO(ms-profesionales): `ProfessionalResponse.OrganizationResponse` todavía no
 * devuelve la comisión ni la fecha de inicio, aunque el alta sí las acepta y la
 * entidad las guarda. Los dos campos se declaran opcionales para que la ficha
 * los pinte en cuanto el backend los exponga y muestre «—» mientras tanto, en
 * vez de dejar dos columnas que nunca se llenan.
 */
export interface ProfessionalOrganizationLinkDetail extends ProfessionalOrganizationLink {
  readonly commissionPercentage?: number | null;
  readonly startDate?: string | null;
}

/** Una especialidad tal como la envía el alta. */
export interface SpecialtyInput {
  readonly code: string;
  readonly primary: boolean;
  readonly graduationYear: number | null;
}

/**
 * Cuerpo de `POST /professionals`, copiado de `CreateProfessionalRequest`.
 *
 * `organizationId` está aquí a disgusto: el centro debería salir del contexto
 * de inquilino en el servidor, porque mandarlo desde el cliente permite
 * escribir en otra organización cambiando un identificador en el navegador.
 * Hoy el `record` de Java lo declara `@NotNull`, así que omitirlo devuelve 400
 * y el alta no funciona. Se envía el de la sesión —nunca uno elegido en la
 * pantalla— y se retira en cuanto el backend lo derive del token.
 */
export interface RegisterProfessionalInput {
  readonly userAccountId: string;
  readonly documentType: ProfessionalDocumentType;
  readonly documentNumber: string;
  readonly documentComplement: string | null;
  readonly givenNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname: string | null;
  readonly professionalType: ProfessionalTypeCode;
  readonly professionalLicenseNumber: string;
  readonly title: string | null;
  readonly biography: string | null;
  readonly specialties: readonly SpecialtyInput[];
  readonly organizationId: string;
  readonly branchId: string | null;
  readonly modality: WorkModality;
  readonly commissionPercentage: number | null;
  readonly startDate: string;
}

/** Campos editables del profesional. El endpoint todavía no existe. */
export type UpdateProfessionalInput = Partial<
  Pick<
    RegisterProfessionalInput,
    | 'givenNames'
    | 'paternalSurname'
    | 'maternalSurname'
    | 'professionalType'
    | 'title'
    | 'biography'
  >
>;

/**
 * Cuenta de ms-identidad, reducida a lo que el alta necesita para elegirla.
 * El profesional se registra sobre una cuenta que ya existe: es esa cuenta la
 * que después inicia sesión y firma los encuentros.
 */
export interface UserAccount {
  readonly publicId: string;
  readonly email: string;
  readonly fullName: string;
  readonly status: string;
}
