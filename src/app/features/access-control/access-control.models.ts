/**
 * Contratos de ms-identidad para roles, permisos y asignaciones.
 * Copiados de los DTO de `web/dto` del servicio (RBAC-01 y RBAC-02).
 */

export type RoleScope = 'PLATFORM' | 'ORGANIZATION';

export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'LOCKED' | 'INACTIVE';

/**
 * Escala MAC (ISO-01), de menor a mayor: clasificación de cada permiso y nivel
 * de autorización de cada cuenta. El token solo lleva los permisos que el nivel cubre.
 */
export const SECURITY_LEVELS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
export type SecurityLevel = (typeof SECURITY_LEVELS)[number];

/** Un permiso del catálogo, con el formato `modulo.recurso.accion`. */
export interface CatalogPermission {
  readonly code: string;
  readonly module: string;
  readonly description: string;
  readonly sensitive: boolean;
  readonly classification: SecurityLevel;
}

export interface Role {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: RoleScope;
  readonly accessModel: 'MAC' | 'DAC' | 'RBAC';
  /** Uno de los roles base (V2 y V9): se puede ajustar, pero no desactivar. */
  readonly system: boolean;
  readonly active: boolean;
  readonly permissions: readonly CatalogPermission[];
  /** Roles que quien tiene este rol puede asignar o revocar (delegación). */
  readonly assignableRoles: readonly string[];
}

export interface CreateRoleInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: RoleScope;
}

/** Los campos ausentes no cambian; `active` desactiva o reactiva. */
export interface UpdateRoleInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly active?: boolean;
}

/** Par de roles que una misma cuenta no puede tener a la vez. */
export interface RoleIncompatibility {
  readonly roleA: string;
  readonly roleB: string;
  readonly reason: string;
  readonly createdByPublicId: string | null;
  readonly createdAt: string;
}

export interface RoleAssignment {
  readonly id: number;
  readonly role: string;
  readonly organizationPublicId: string | null;
  readonly branchPublicId: string | null;
  readonly validFrom: string;
  readonly validUntil: string | null;
  /** Da acceso hoy: vigente por fechas y con el rol activo. */
  readonly active: boolean;
}

export interface IdentityAccount {
  readonly publicId: string;
  /** User ID estándar MS-AA-NNNNN (IAM-04): único, inmutable, nunca reutilizado. */
  readonly userCode: string;
  readonly organizationPublicId: string | null;
  readonly email: string;
  readonly fullName: string;
  readonly phoneE164: string | null;
  readonly status: AccountStatus;
  readonly clearance: SecurityLevel;
  readonly lastAccessAt: string | null;
  readonly roles: readonly RoleAssignment[];
}

/** Alta (IAM-04): sin contraseña; el servicio genera una temporal de un solo uso. */
export interface CreateAccountInput {
  readonly email: string;
  readonly fullName: string;
  readonly phoneE164: string | null;
  readonly activateImmediately: boolean;
  readonly roles: readonly AssignRoleInput[];
}

export interface UpdateAccountInput {
  readonly fullName: string;
  readonly email: string;
  readonly phoneE164: string | null;
}

/** El alta devuelve la contraseña temporal una sola vez. */
export interface CreatedAccount extends IdentityAccount {
  readonly temporaryPassword?: string;
}

/** Reinicio de contraseña (IAM-05): la temporal se muestra una sola vez. */
export interface TemporaryPassword {
  readonly publicId: string;
  readonly userCode: string;
  readonly temporaryPassword: string;
}

export interface AssignRoleInput {
  readonly role: string;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
}
