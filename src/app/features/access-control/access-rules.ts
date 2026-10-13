import { Tone } from '../../core/state/state-machines';
import { IdentityAccount, Role, RoleAssignment } from './access-control.models';

/**
 * Reglas de gobierno de ms-identidad (`RoleGovernance`, RBAC-02) que la
 * interfaz anticipa para no ofrecer lo que el servicio va a rechazar. El
 * servicio sigue siendo quien decide: si una regla de aquí se queda atrás, la
 * operación vuelve con su 403 o 409 y ese mensaje es el que se muestra.
 */

/** Módulos cuyos permisos administran el acceso de otras personas. */
const MANAGEMENT_MODULES = new Set(['IDENTITY', 'TENANCY']);

/** Permisos de gestión de accesos que reúnen estos roles y quien actúa no tiene. */
function managementAbove(roles: readonly Role[], actorPermissions: readonly string[]): boolean {
  return roles.some((role) =>
    role.permissions.some(
      (permission) =>
        MANAGEMENT_MODULES.has(permission.module) && !actorPermissions.includes(permission.code),
    ),
  );
}

/**
 * Por qué quien actúa no puede editar este rol, o `null` si puede.
 * Nadie edita un rol que tiene asignado, ni uno con permisos de gestión que no tiene.
 */
export function roleEditLock(
  role: Role,
  actorRoles: readonly string[],
  actorPermissions: readonly string[],
): string | null {
  if (actorRoles.includes(role.code)) {
    return 'Lo tienes asignado, y nadie edita un rol propio (segregación de funciones).';
  }
  if (managementAbove([role], actorPermissions)) {
    return 'Tiene permisos de gestión de accesos que tú no tienes: un rol por encima del tuyo no se edita.';
  }
  return null;
}

/** Al editar un rol solo se agregan permisos que quien edita ya tiene. Quitar nunca escala. */
export function canGrant(code: string, actorPermissions: readonly string[]): boolean {
  return actorPermissions.includes(code);
}

/**
 * Roles que quien actúa puede asignar o revocar. Con un rol de plataforma,
 * cualquiera; si no, solo los que sus roles tienen delegados y nunca uno de
 * plataforma. En los dos casos, ninguno que otorgue permisos de gestión que
 * quien actúa no tiene.
 */
export function manageableRoles(
  roles: readonly Role[],
  actorRoles: readonly string[],
  actorPermissions: readonly string[],
): ReadonlySet<string> {
  const mine = roles.filter((role) => role.active && actorRoles.includes(role.code));
  const platform = mine.some((role) => role.scope === 'PLATFORM');
  const delegated = new Set(mine.flatMap((role) => role.assignableRoles));
  return new Set(
    roles
      .filter(
        (role) =>
          (platform || (role.scope !== 'PLATFORM' && delegated.has(role.code))) &&
          !managementAbove([role], actorPermissions),
      )
      .map((role) => role.code),
  );
}

/**
 * Por qué quien actúa no puede cambiar los roles de esta cuenta, o `null`.
 * Nadie gestiona sus propios accesos, ni los de una cuenta con permisos de
 * gestión que no tiene (la de PLATFORM_ADMIN, para un administrador de centro).
 */
export function accountLock(
  account: IdentityAccount,
  actorId: string | null,
  roles: readonly Role[],
  actorPermissions: readonly string[],
): string | null {
  if (account.publicId === actorId) {
    return 'Es tu propia cuenta: nadie se asigna ni se revoca roles a sí mismo.';
  }
  // Cuentan los permisos que la cuenta ejerce hoy, no los de una asignación vencida.
  const held = new Set(
    account.roles.filter((assignment) => assignment.active).map((assignment) => assignment.role),
  );
  if (
    managementAbove(
      roles.filter((role) => held.has(role.code)),
      actorPermissions,
    )
  ) {
    return 'La cuenta tiene permisos de gestión de accesos que tú no tienes, así que no puedes cambiar sus roles.';
  }
  return null;
}

/**
 * Por qué quien actúa no puede modificar los datos, el estado o la contraseña de esta cuenta
 * (IAM-06), o `null` si puede. Es la regla de `RoleGovernance.checkCanManageAccount`: nadie gestiona
 * una cuenta con permisos de gestión de accesos que no tiene. A diferencia de los roles, los datos de
 * la propia cuenta sí se editan; la baja y el reinicio de la propia cuenta no se ofrecen.
 */
export function accountManagementLock(
  account: IdentityAccount,
  roles: readonly Role[],
  actorPermissions: readonly string[],
): string | null {
  const held = new Set(
    account.roles.filter((assignment) => assignment.active).map((assignment) => assignment.role),
  );
  return managementAbove(
    roles.filter((role) => held.has(role.code)),
    actorPermissions,
  )
    ? 'La cuenta tiene permisos de gestión de accesos que tú no tienes, así que no puedes modificarla.'
    : null;
}

/** Estado de un rol, que el servicio expresa como `active`. */
export const ROLE_STATE: Record<string, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo' };

/** Una cuenta bloqueada o sin activar se distingue de un vistazo. */
export const ACCOUNT_TONES: Record<string, Tone> = { LOCKED: 'err', PENDING_ACTIVATION: 'warn' };

export type AssignmentState = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'ROLE_INACTIVE';

export const ASSIGNMENT_STATE: Record<AssignmentState, string> = {
  ACTIVE: 'Vigente',
  SCHEDULED: 'Programada',
  EXPIRED: 'Vencida',
  ROLE_INACTIVE: 'Rol inactivo',
};

export const assignmentTone: Record<AssignmentState, Tone> = {
  ACTIVE: 'ok',
  SCHEDULED: 'brand',
  EXPIRED: 'muted',
  ROLE_INACTIVE: 'warn',
};

/** Por qué una asignación da o no da acceso hoy. `today` en `aaaa-mm-dd`. */
export function assignmentState(assignment: RoleAssignment, today: string): AssignmentState {
  if (assignment.active) {
    return 'ACTIVE';
  }
  if (assignment.validFrom > today) {
    return 'SCHEDULED';
  }
  if (assignment.validUntil !== null && assignment.validUntil < today) {
    return 'EXPIRED';
  }
  return 'ROLE_INACTIVE';
}
