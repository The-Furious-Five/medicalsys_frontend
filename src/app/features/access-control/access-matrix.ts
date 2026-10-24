import { PERMISSION_MODULE, ROLE_SCOPE, label } from '../../core/labels/labels';
import { CatalogPermission, Role } from './access-control.models';

/**
 * Columnas de la matriz de roles y accesos (RBAC-06) y las acciones del
 * catálogo que caen en cada una. Es la tabla del Anexo B de la política de
 * control de acceso (PO-02): una acción nueva del catálogo se agrega allí y
 * aquí antes de publicarse.
 */
export const MATRIX_COLUMNS: readonly (readonly [string, readonly string[]])[] = [
  ['R', ['read', 'read_history', 'view', 'download']],
  [
    'C',
    ['create', 'open', 'upload', 'generate', 'issue', 'record', 'request', 'subscribe', 'track'],
  ],
  [
    'U',
    [
      'update',
      'update_notes',
      'change_status',
      'classify',
      'link',
      'attach_document',
      'schedule',
      'schedule_collection',
      'reschedule',
      'check_in',
      'no_show',
      'mark_in_use',
      'release',
      'share',
      'pause',
      'finish',
      'reset',
      'unlock',
    ],
  ],
  ['D', ['delete', 'deactivate', 'cancel', 'void', 'revoke']],
  ['Aprobar', ['sign', 'confirm', 'publish', 'reject']],
  [
    'Ejecutar',
    [
      'attend',
      'dispatch',
      'retry',
      'send',
      'launch',
      'redeem',
      'validate',
      'evaluate',
      'export',
      'verify',
      'build_audience',
      'request_otp',
      'assign',
      'manage',
    ],
  ],
];

const COLUMN_BY_ACTION = new Map(
  MATRIX_COLUMNS.flatMap(([column, actions]) => actions.map((action) => [action, column])),
);

/** Columna de la matriz para un permiso, por su acción. Una acción sin columna se ve, no se esconde. */
export function matrixColumn(code: string): string {
  const action = code.slice(code.lastIndexOf('.') + 1);
  return COLUMN_BY_ACTION.get(action) ?? '—';
}

export interface ModuleGroup {
  readonly module: string;
  readonly label: string;
  readonly permissions: readonly CatalogPermission[];
}

const MODULE_ORDER = Object.keys(PERMISSION_MODULE);

/** Agrupa el catálogo por módulo, en el orden del enum del servicio. */
export function groupByModule(permissions: readonly CatalogPermission[]): readonly ModuleGroup[] {
  const groups = new Map<string, CatalogPermission[]>();
  for (const permission of permissions) {
    const group = groups.get(permission.module) ?? [];
    group.push(permission);
    groups.set(permission.module, group);
  }
  const rank = (module: string) => {
    const index = MODULE_ORDER.indexOf(module);
    return index === -1 ? MODULE_ORDER.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([module, items]) => ({
      module,
      label: label(PERMISSION_MODULE, module),
      permissions: [...items].sort((a, b) => a.code.localeCompare(b.code)),
    }));
}

/** Los roles de sistema en el orden de la operación; después, los creados desde la API. */
const SYSTEM_ORDER = [
  'PLATFORM_ADMIN',
  'ADMINISTRATOR',
  'PHYSICIAN',
  'RECEPTIONIST',
  'BILLING_CLERK',
  'PATIENT',
];

export function orderRoles(roles: readonly Role[]): readonly Role[] {
  const rank = (role: Role) => {
    const index = SYSTEM_ORDER.indexOf(role.code);
    return index === -1 ? SYSTEM_ORDER.length : index;
  };
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
}

/** Permisos de cada rol: código del rol → códigos de permiso. */
export type Grid = ReadonlyMap<string, ReadonlySet<string>>;

export function gridOf(roles: readonly Role[]): Grid {
  return new Map(
    roles.map((role) => [role.code, new Set(role.permissions.map((item) => item.code))]),
  );
}

export interface RoleChange {
  readonly role: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/** Lo que el borrador cambia respecto de lo guardado, rol por rol. */
export function changesBetween(saved: Grid, draft: Grid): readonly RoleChange[] {
  const changes: RoleChange[] = [];
  for (const [role, wanted] of draft) {
    const current = saved.get(role) ?? new Set<string>();
    const added = [...wanted].filter((code) => !current.has(code)).sort();
    const removed = [...current].filter((code) => !wanted.has(code)).sort();
    if (added.length > 0 || removed.length > 0) {
      changes.push({ role, added, removed });
    }
  }
  return changes;
}

export type Table = readonly (readonly string[])[];

/**
 * La matriz como tabla: una fila por permiso y una columna por rol, con la
 * columna C/R/U/D/Aprobar/Ejecutar que pide RBAC-06. Es lo que se exporta y lo
 * que la matriz aprobada debe reproducir 1:1.
 */
export function matrixTable(
  roles: readonly Role[],
  permissions: readonly CatalogPermission[],
): Table {
  const ordered = orderRoles(roles);
  const grid = gridOf(ordered);
  const header = [
    'Módulo',
    'Permiso',
    'Descripción',
    'Sensible',
    'Columna',
    ...ordered.map((role) => (role.active ? role.code : `${role.code} (inactivo)`)),
  ];
  const rows = groupByModule(permissions).flatMap((group) =>
    group.permissions.map((permission) => [
      group.label,
      permission.code,
      permission.description,
      permission.sensitive ? 'Sí' : 'No',
      matrixColumn(permission.code),
      ...ordered.map((role) => (grid.get(role.code)?.has(permission.code) ? 'X' : '')),
    ]),
  );
  return [header, ...rows];
}

/** Los roles con su alcance, estado y delegación: la otra mitad de la matriz. */
export function rolesTable(roles: readonly Role[]): Table {
  return [
    ['Rol', 'Nombre', 'Alcance', 'Estado', 'De sistema', 'Permisos', 'Puede asignar'],
    ...orderRoles(roles).map((role) => [
      role.code,
      role.name,
      label(ROLE_SCOPE, role.scope),
      role.active ? 'Activo' : 'Inactivo',
      role.system ? 'Sí' : 'No',
      String(role.permissions.length),
      role.scope === 'PLATFORM' ? 'Cualquier rol' : role.assignableRoles.join(' '),
    ]),
  ];
}

/**
 * Una celda que empieza con `=`, `+`, `-`, `@` o un tabulador la ejecuta como
 * fórmula la hoja de cálculo que abre el CSV. El nombre y la descripción de un
 * rol los escribe una persona, así que esas celdas se neutralizan con un
 * apóstrofo, que la hoja muestra como texto.
 */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = neutralize(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV según RFC 4180, con fin de línea CRLF. */
export function toCsv(table: Table): string {
  return table.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
