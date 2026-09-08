/**
 * Roles del sistema y lo que cada uno puede hacer en esta interfaz.
 *
 * La tabla se derivó de las anotaciones `@RequiresRole` reales de cada
 * controlador. Si la interfaz ofreciera algo que el backend rechaza, el usuario
 * chocaría contra un 403 después de haber hecho el trabajo; por eso se lee del
 * código del servicio y no de la documentación.
 */
export type Role =
  | 'PLATFORM_ADMIN'
  | 'ADMINISTRATOR'
  | 'MARKETING_MANAGER'
  | 'PHYSICIAN'
  | 'RECEPTIONIST'
  | 'BILLING_CLERK'
  | 'PATIENT';

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

  /* ms-agenda.
     El servicio no anota roles —el gateway lo publica abierto—, así que aquí la
     regla es la del mostrador real: recepción y profesionales trabajan con la
     agenda del día; la disponibilidad y los consultorios los define quien
     organiza el centro, no quien atiende. */
  viewSchedule: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'PHYSICIAN', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  manageAppointments: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'PHYSICIAN', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  manageAvailability: (r: Roles) => has(r, 'PHYSICIAN', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  manageResources: (r: Roles) => has(r, 'ADMINISTRATOR', 'PLATFORM_ADMIN'),

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

  /* ms-marketing.
     El servicio declara `MARKETING_MANAGER` para el día en que ms-identidad lo
     emita; hoy ningún token lo trae, así que cada permiso acepta además
     `ADMINISTRATOR`. Si dependiera solo del rol futuro, la sección quedaría
     inalcanzable para todo el mundo.

     La lectura se abre a recepción porque el mostrador necesita saber qué
     campaña está corriendo cuando un paciente llama por el mensaje que recibió.
     Los cupones los consulta y canjea caja, que es quien cobra. */
  viewMarketing: (r: Roles) =>
    has(r, 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN', 'RECEPTIONIST'),
  manageMarketing: (r: Roles) => has(r, 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  viewCoupons: (r: Roles) =>
    has(r, 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN', 'RECEPTIONIST', 'BILLING_CLERK'),
  redeemCoupons: (r: Roles) =>
    has(r, 'BILLING_CLERK', 'RECEPTIONIST', 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  viewLoyalty: (r: Roles) =>
    has(r, 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN', 'RECEPTIONIST', 'BILLING_CLERK'),
  /* Acumular no está: llega por evento desde ms-facturacion con su clave de
     idempotencia, y el servicio rechaza el asiento manual de tipo ACCRUAL. */
  registerLoyaltyMovement: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'BILLING_CLERK', 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),
  manageOptOut: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'MARKETING_MANAGER', 'ADMINISTRATOR', 'PLATFORM_ADMIN'),

  /* ms-catalogos.
     El catálogo es material de referencia de solo lectura —CIE-10, vademécum,
     tipos de estudio, especialidades— y lo consulta cualquiera que ya haya
     entrado: el médico busca un código mientras diagnostica, recepción
     confirma el nombre de un estudio al citar y caja comprueba qué se está
     cobrando. No hay dato de ninguna persona detrás, así que restringirlo solo
     obligaría a preguntar a un compañero. */
  viewCatalogs: (r: Roles) =>
    has(r, 'ADMINISTRATOR', 'PHYSICIAN', 'RECEPTIONIST', 'BILLING_CLERK', 'PLATFORM_ADMIN'),

  /* ms-pacientes, servicio de apoyo */
  viewPatients: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'ADMINISTRATOR', 'PHYSICIAN', 'BILLING_CLERK', 'PLATFORM_ADMIN'),
  registerPatient: (r: Roles) =>
    has(r, 'RECEPTIONIST', 'ADMINISTRATOR', 'PHYSICIAN', 'PLATFORM_ADMIN'),
} as const;

export type Permission = keyof typeof can;
