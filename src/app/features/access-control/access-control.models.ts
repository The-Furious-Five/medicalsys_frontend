/**
 * Contratos de ms-identidad para roles, permisos y asignaciones.
 * Copiados de los DTO de `web/dto` del servicio (RBAC-01 y RBAC-02).
 */

export type RoleScope = 'PLATFORM' | 'ORGANIZATION';

export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'LOCKED' | 'INACTIVE';

/** Un permiso del catálogo, con el formato `modulo.recurso.accion`. */
export interface CatalogPermission {
  readonly code: string;
  readonly module: string;
  readonly description: string;
  readonly sensitive: boolean;
}

export interface Role {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: RoleScope;
  /** Uno de los seis roles base: se puede ajustar, pero no desactivar. */
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
  readonly organizationPublicId: string | null;
  readonly email: string;
  readonly fullName: string;
  readonly status: AccountStatus;
  readonly lastAccessAt: string | null;
  readonly roles: readonly RoleAssignment[];
}

export interface AssignRoleInput {
  readonly role: string;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
}
