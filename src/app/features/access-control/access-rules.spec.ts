import { describe, expect, it } from 'vitest';
import { CatalogPermission, IdentityAccount, Role, RoleAssignment } from './access-control.models';
import {
  accountLock,
  accountManagementLock,
  assignmentState,
  manageableRoles,
  roleEditLock,
} from './access-rules';

const permission = (code: string, module: string): CatalogPermission => ({
  code,
  module,
  description: code,
  sensitive: false,
});

const ROLE_MANAGE = permission('identity.role.manage', 'IDENTITY');
const ROLE_ASSIGN = permission('identity.role.assign', 'IDENTITY');
const RECORD_READ = permission('clinical.record.read', 'CLINICAL');

const role = (code: string, extra: Partial<Role> = {}): Role => ({
  code,
  name: code,
  description: null,
  scope: 'ORGANIZATION',
  system: true,
  active: true,
  permissions: [],
  assignableRoles: [],
  ...extra,
});

const PLATFORM_ADMIN = role('PLATFORM_ADMIN', {
  scope: 'PLATFORM',
  permissions: [ROLE_MANAGE, ROLE_ASSIGN, RECORD_READ],
});
const ADMINISTRATOR = role('ADMINISTRATOR', {
  permissions: [ROLE_ASSIGN],
  assignableRoles: ['ADMINISTRATOR', 'PHYSICIAN', 'PLATFORM_ADMIN'],
});
const PHYSICIAN = role('PHYSICIAN', { permissions: [RECORD_READ] });
const AUDITOR = role('AUDITOR', { system: false });
const ROLES = [PLATFORM_ADMIN, ADMINISTRATOR, PHYSICIAN, AUDITOR];

const assignment = (code: string, extra: Partial<RoleAssignment> = {}): RoleAssignment => ({
  id: 1,
  role: code,
  organizationPublicId: 'org',
  branchPublicId: null,
  validFrom: '2026-01-01',
  validUntil: null,
  active: true,
  ...extra,
});

/** Las mismas reglas con las que `RoleGovernance` de ms-identidad responde 403. */
describe('reglas de gobierno anticipadas', () => {
  it('nadie edita un rol que tiene ni uno con permisos de gestión que no tiene', () => {
    const security = ['identity.role.manage', 'identity.role.assign', 'clinical.record.read'];

    expect(roleEditLock(PLATFORM_ADMIN, ['PLATFORM_ADMIN'], security)).toContain(
      'Lo tienes asignado',
    );
    expect(roleEditLock(PLATFORM_ADMIN, ['SECURITY_OFFICER'], ['identity.role.assign'])).toContain(
      'por encima del tuyo',
    );
    // Un oficial de seguridad a su altura, que no lo ejerce, sí puede corregirlo.
    expect(roleEditLock(PLATFORM_ADMIN, ['SECURITY_OFFICER'], security)).toBeNull();
  });

  it('administración asigna solo lo delegado, nunca un rol de plataforma', () => {
    const delegated = manageableRoles(ROLES, ['ADMINISTRATOR'], ['identity.role.assign']);
    // PLATFORM_ADMIN figura delegado por error y aun así no se ofrece; AUDITOR no está delegado.
    expect([...delegated].sort()).toEqual(['ADMINISTRATOR', 'PHYSICIAN']);

    const platform = manageableRoles(
      ROLES,
      ['PLATFORM_ADMIN'],
      ['identity.role.manage', 'identity.role.assign'],
    );
    expect([...platform].sort()).toEqual([
      'ADMINISTRATOR',
      'AUDITOR',
      'PHYSICIAN',
      'PLATFORM_ADMIN',
    ]);
  });

  it('la cuenta propia y la de alguien por encima quedan en lectura', () => {
    const account = (roles: readonly RoleAssignment[]): IdentityAccount => ({
      publicId: 'target',
      userCode: 'MS-26-00001',
      organizationPublicId: 'org',
      email: 'x@medicalsys.bo',
      fullName: 'X',
      phoneE164: null,
      status: 'ACTIVE',
      lastAccessAt: null,
      roles,
    });
    const admin = ['identity.role.assign'];

    expect(accountLock(account([]), 'target', ROLES, admin)).toContain('propia cuenta');
    expect(accountLock(account([assignment('PLATFORM_ADMIN')]), 'me', ROLES, admin)).toContain(
      'permisos de gestión',
    );
    // Una asignación vencida no cuenta: hoy no le da a la cuenta ningún permiso.
    expect(
      accountLock(account([assignment('PLATFORM_ADMIN', { active: false })]), 'me', ROLES, admin),
    ).toBeNull();
  });

  it('explica por qué una asignación da o no da acceso hoy', () => {
    const today = '2026-10-10';
    expect(assignmentState(assignment('PHYSICIAN'), today)).toBe('ACTIVE');
    expect(
      assignmentState(assignment('PHYSICIAN', { active: false, validFrom: '2026-11-01' }), today),
    ).toBe('SCHEDULED');
    expect(
      assignmentState(assignment('PHYSICIAN', { active: false, validUntil: '2026-10-09' }), today),
    ).toBe('EXPIRED');
    expect(assignmentState(assignment('PHYSICIAN', { active: false }), today)).toBe(
      'ROLE_INACTIVE',
    );
  });
});

describe('accountManagementLock (IAM-06)', () => {
  const account = (roles: readonly RoleAssignment[]): IdentityAccount => ({
    publicId: 'target',
    userCode: 'MS-26-00002',
    organizationPublicId: 'org',
    email: 'x@medicalsys.bo',
    fullName: 'X',
    phoneE164: null,
    status: 'ACTIVE',
    lastAccessAt: null,
    roles,
  });

  it('deja gestionar una cuenta sin permisos de gestión por encima de los propios', () => {
    expect(
      accountManagementLock(account([assignment('PHYSICIAN')]), ROLES, ['identity.role.assign']),
    ).toBeNull();
  });

  it('bloquea una cuenta con permisos de gestión que quien actúa no tiene', () => {
    expect(
      accountManagementLock(account([assignment('PLATFORM_ADMIN')]), ROLES, [
        'identity.role.assign',
      ]),
    ).toContain('no puedes modificarla');
  });

  it('una asignación vencida no cuenta', () => {
    expect(
      accountManagementLock(account([assignment('PLATFORM_ADMIN', { active: false })]), ROLES, [
        'identity.role.assign',
      ]),
    ).toBeNull();
  });
});
