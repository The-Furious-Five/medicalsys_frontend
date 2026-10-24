/**
 * Qué puede hacer en esta interfaz quien inició sesión.
 *
 * Cada regla exige el permiso del catálogo (`modulo.recurso.accion`, RBAC-01)
 * del endpoint que la pantalla o el botón usa, tomado de la hoja endpoint →
 * permiso de la plataforma (`docs/seguridad/rbac-01-endpoints-permisos.csv`).
 * Los servicios autorizan con ese mismo permiso (RBAC-03), así que la interfaz
 * no ofrece una puerta que el backend vaya a cerrar con un 403.
 *
 * Se decide por permisos y no por roles porque los roles se editan desde la
 * matriz de accesos (RBAC-05): quitarle un permiso a un rol, o crear uno nuevo
 * como AUDITOR, cambia lo que se ve en el siguiente inicio de sesión sin tocar
 * este archivo.
 *
 * Cuando una pantalla ofrece varias acciones del mismo recurso y la asignación
 * inicial las da a los mismos roles, la regla usa el permiso de la acción
 * principal. Si la matriz llega a separarlas, la acción restante la sigue
 * rechazando el servicio y la interfaz muestra su 403.
 */
export type Grants = readonly string[];

const has = (granted: Grants, code: string): boolean => granted.includes(code);
const anyOf = (granted: Grants, ...codes: string[]): boolean =>
  codes.some((code) => granted.includes(code));

export const can = {
  /* El inicio se adapta a los permisos de cada uno: lo ve cualquiera con sesión. */
  viewHome: () => true,

  /* ms-historial */
  viewRecords: (g: Grants) => has(g, 'clinical.record.read'),
  viewEncounters: (g: Grants) => has(g, 'clinical.encounter.read'),
  openRecord: (g: Grants) => has(g, 'clinical.record.create'),
  openEncounter: (g: Grants) => has(g, 'clinical.encounter.open'),
  writeNarrative: (g: Grants) => has(g, 'clinical.encounter.update_notes'),
  signEncounter: (g: Grants) => has(g, 'clinical.encounter.sign'),
  voidEncounter: (g: Grants) => has(g, 'clinical.encounter.void'),
  writeAddendum: (g: Grants) => has(g, 'clinical.addendum.create'),
  writeAllergies: (g: Grants) => has(g, 'clinical.allergy.create'),
  writeVitals: (g: Grants) => has(g, 'clinical.vital_sign.create'),
  viewStudyOrders: (g: Grants) => has(g, 'clinical.study_order.read'),

  /* ms-profesionales */
  viewProfessionals: (g: Grants) => has(g, 'professionals.professional.read'),
  manageProfessionals: (g: Grants) => has(g, 'professionals.professional.create'),

  /* ms-agenda */
  viewSchedule: (g: Grants) => has(g, 'scheduling.appointment.read'),
  manageAvailability: (g: Grants) => has(g, 'scheduling.availability.create'),
  manageResources: (g: Grants) => has(g, 'scheduling.resource.create'),

  /* ms-tenencia */
  viewOrganization: (g: Grants) => has(g, 'tenancy.organization.read'),
  manageOrganization: (g: Grants) => has(g, 'tenancy.organization.update'),
  viewOfferings: (g: Grants) => has(g, 'tenancy.service_offering.read'),
  manageOfferings: (g: Grants) => has(g, 'tenancy.service_offering.create'),
  viewSubscription: (g: Grants) => has(g, 'tenancy.subscription.read'),
  viewUsage: (g: Grants) => has(g, 'tenancy.usage.read'),

  /* ms-facturacion.
     La anulación y las notas de crédito y débito todavía no existen en el
     servicio, que solo publica emitir y consultar. Su permiso no está en el
     catálogo y por eso nadie ve el botón: cuando el endpoint exista, el permiso
     entra al catálogo con una migración y la matriz decide quién lo tiene. */
  viewInvoices: (g: Grants) => has(g, 'billing.invoice.read'),
  issueInvoice: (g: Grants) => has(g, 'billing.invoice.issue'),
  correctInvoice: (g: Grants) => has(g, 'billing.invoice.void'),

  /* ms-marketing */
  viewCampaigns: (g: Grants) => has(g, 'marketing.campaign.read'),
  manageCampaigns: (g: Grants) => has(g, 'marketing.campaign.create'),
  viewSegments: (g: Grants) => has(g, 'marketing.segment.read'),
  manageSegments: (g: Grants) => has(g, 'marketing.segment.create'),
  viewCoupons: (g: Grants) => has(g, 'marketing.promotion.read'),
  manageCoupons: (g: Grants) => has(g, 'marketing.promotion.create'),
  redeemCoupons: (g: Grants) => has(g, 'marketing.coupon.redeem'),
  viewAdvertisements: (g: Grants) => has(g, 'marketing.advertisement.read'),
  manageAdvertisements: (g: Grants) => has(g, 'marketing.advertisement.create'),
  /* La pantalla abre con la lista de programas: sin ese permiso no hay nada
     que mostrar, aunque el saldo de un paciente sí se pudiera consultar. */
  viewLoyalty: (g: Grants) => has(g, 'marketing.loyalty_program.read'),
  manageLoyalty: (g: Grants) => has(g, 'marketing.loyalty_program.create'),
  registerLoyaltyMovement: (g: Grants) => has(g, 'marketing.loyalty_movement.create'),
  viewCommercialActivity: (g: Grants) => has(g, 'marketing.patient_activity.read'),
  manageOptOut: (g: Grants) => has(g, 'marketing.opt_out.update'),

  /* ms-auditoria */
  viewAudit: (g: Grants) => has(g, 'audit.log.read'),
  /* El OSI (ISO-01) revisa la bitácora de todas las organizaciones, no solo la de su sesión. */
  viewPlatformAudit: (g: Grants) => has(g, 'audit.log.read_platform'),

  /* ms-catalogos. La pantalla reúne los cinco catálogos de referencia. */
  viewCatalogs: (g: Grants) =>
    anyOf(
      g,
      'catalogs.icd10.read',
      'catalogs.medication.read',
      'catalogs.specialty.read',
      'catalogs.study_type.read',
      'catalogs.tax.read',
    ),

  /* ms-pacientes */
  viewPatients: (g: Grants) => has(g, 'patients.patient.read'),
  registerPatient: (g: Grants) => has(g, 'patients.patient.create'),
  /* DAC (ISO-01): el paciente, dueño del dato, autoriza con un OTP a otra
     organización. Aquí solo se pide, se registra el código que él dicta y se revoca. */
  viewAccessGrants: (g: Grants) => has(g, 'patients.access_grant.read'),
  requestAccessGrant: (g: Grants) => has(g, 'patients.access_grant.request'),
  confirmAccessGrant: (g: Grants) => has(g, 'patients.access_grant.confirm'),
  revokeAccessGrant: (g: Grants) => has(g, 'patients.access_grant.revoke'),

  /* ms-identidad: roles, matriz de accesos y asignación (RBAC-05).
     Asignar roles exige además ver las cuentas y los roles, porque la pantalla
     lista unas y ofrece los otros. */
  viewRoles: (g: Grants) => has(g, 'identity.role.read'),
  manageRoles: (g: Grants) => has(g, 'identity.role.manage'),
  viewRoleAssignments: (g: Grants) => has(g, 'identity.user.read') && has(g, 'identity.role.read'),
  assignRoles: (g: Grants) => has(g, 'identity.role.assign'),
  /* MAC (ISO-01): fijar el nivel de autorización de una cuenta es del OSI. */
  manageClearance: (g: Grants) => has(g, 'identity.clearance.manage'),

  /* ms-identidad: gestión de usuarios (IAM-06). El alta ofrece un rol inicial, así que también
     lee los roles; cada botón de la hoja pide el permiso de su endpoint. */
  viewUsers: (g: Grants) => has(g, 'identity.user.read') && has(g, 'identity.role.read'),
  createUsers: (g: Grants) => has(g, 'identity.user.create'),
  updateUsers: (g: Grants) => has(g, 'identity.user.update'),
  changeUserStatus: (g: Grants) => has(g, 'identity.user.change_status'),
  unlockUsers: (g: Grants) => has(g, 'identity.user.unlock'),
  resetPasswords: (g: Grants) => has(g, 'identity.user.reset'),
} as const;

export type Permission = keyof typeof can;
