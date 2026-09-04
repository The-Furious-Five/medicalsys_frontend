/**
 * Roles del sistema y lo que cada uno puede hacer en esta interfaz.
 *
 * La tabla se derivó de las anotaciones `@RequiresRole` reales de cada
 * controlador. Si la interfaz ofreciera algo que el backend rechaza, el usuario
 * chocaría contra un 403 después de haber hecho el trabajo; por eso se lee del
 * código del servicio y no de la documentación.
 */
export type Role =
  'PLATFORM_ADMIN' | 'ADMINISTRATOR' | 'PHYSICIAN' | 'RECEPTIONIST' | 'BILLING_CLERK' | 'PATIENT';

export type Roles = readonly string[];

const has = (roles: Roles, ...allowed: Role[]): boolean =>
  roles.some((role) => (allowed as string[]).includes(role));

export const can = {
  /* ms-historial */
  viewRecords: (r: Roles) => has(r, 'PHYSICIAN', 'RECEPTIONIST', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  openRecord: (r: Roles) => has(r, 'PHYSICIAN', 'RECEPTIONIST', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  openEncounter: (r: Roles) => has(r, 'PHYSICIAN', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  writeNarrative: (r: Roles) => has(r, 'PHYSICIAN', 'PLATFORM_ADMIN'),
  signEncounter: (r: Roles) => has(r, 'PHYSICIAN', 'PLATFORM_ADMIN'),
  voidEncounter: (r: Roles) => has(r, 'PHYSICIAN', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  writeAllergies: (r: Roles) => has(r, 'PHYSICIAN', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  writeVitals: (r: Roles) => has(r, 'PHYSICIAN', 'RECEPTIONIST', 'PLATFORM_ADMIN'),
  manageStudyOrders: (r: Roles) =>
    has(r, 'PHYSICIAN', 'RECEPTIONIST', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),

  /* ms-profesionales.
     Recepción consulta el directorio para saber a quién citar, pero no da de
     alta ni desactiva vínculos: eso cambia quién puede atender en el centro y
     lo decide quien lo organiza. */
  viewProfessionals: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'ADMINISTRATOR', 'PHYSICIAN', 'PLATFORM_ADMIN'),
  manageProfessionals: (r: Roles) => has(r, 'ADMINISTRATOR', 'PLATFORM_ADMIN'),

  /* ms-tenencia */
  viewOrganization: (r: Roles) =>
    has(r, 'ADMINISTRATOR', 'RECEPTIONIST', 'BILLING_CLERK', 'PHYSICIAN', 'PLATFORM_ADMIN'),
  manageOrganization: (r: Roles) => has(r, 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  viewSubscription: (r: Roles) => has(r, 'ADMINISTRATOR', 'BILLING_CLERK', 'PLATFORM_ADMIN'),
  viewUsage: (r: Roles) => has(r, 'ADMINISTRATOR', 'PLATFORM_ADMIN'),

  /* ms-facturacion */
  viewInvoices: (r: Roles) =>
    has(r, 'BILLING_CLERK', 'RECEPTIONIST', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  issueInvoice: (r: Roles) =>
    has(r, 'BILLING_CLERK', 'RECEPTIONIST', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),

  /* ms-pacientes, servicio de apoyo */
  viewPatients: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'ADMINISTRATOR', 'PHYSICIAN', 'BILLING_CLERK', 'PLATFORM_ADMIN'),
  registerPatient: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'ADMINISTRATOR', 'PHYSICIAN', 'PLATFORM_ADMIN'),
} as const;

export type Permission = keyof typeof can;
