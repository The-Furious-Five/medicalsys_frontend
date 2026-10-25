import { describeFailure } from '../../core/http/api-error';
import { ROLE } from '../../core/labels/labels';
import { IconName } from '../../core/ui/icon';
import { CatalogPermission, Role } from './access-control.models';

export interface AccessArea {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: IconName;
  readonly permissions: readonly CatalogPermission[];
}

const AREAS = [
  ['patients', 'Pacientes', 'Fichas, datos de contacto y accesos entre centros.', 'users'],
  [
    'clinical',
    'Historia clínica',
    'Expedientes, atenciones y seguimiento del paciente.',
    'stethoscope',
  ],
  ['scheduling', 'Agenda', 'Citas, disponibilidad y recursos del centro.', 'calendar'],
  [
    'documents',
    'Documentos y consentimientos',
    'Documentos clínicos y autorizaciones del paciente.',
    'file-signature',
  ],
  ['billing', 'Cobros y beneficios', 'Facturas, cupones y programas de puntos.', 'receipt'],
  ['marketing', 'Campañas y anuncios', 'Campañas, públicos y anuncios del centro.', 'megaphone'],
  [
    'notifications',
    'Comunicaciones',
    'Mensajes, recordatorios y sus reglas de envío.',
    'message-plus',
  ],
  ['organization', 'Organización', 'Centros, sucursales, prestaciones y planes.', 'building'],
  [
    'security',
    'Usuarios y seguridad',
    'Cuentas, roles y revisión de la actividad.',
    'shield-check',
  ],
  [
    'catalogs',
    'Catálogos de apoyo',
    'Información de referencia para la atención.',
    'clipboard-list',
  ],
  [
    'infrastructure',
    'Tecnología',
    'Servidores, bases de datos y protección de la información.',
    'settings',
  ],
] as const;

const PURPOSES: Readonly<Record<string, string>> = {
  PLATFORM_ADMIN: 'Organizaciones, sucursales y planes de la plataforma.',
  OSI: 'Protección de la información y control de accesos.',
  AUDITOR: 'Revisión de la actividad y sus informes.',
  EXTERNAL_AUDITOR: 'Consulta de la actividad autorizada para su revisión.',
  ADMINISTRATOR: 'Organización del centro y alta del personal.',
  PHYSICIAN: 'Atención y seguimiento clínico del paciente.',
  MEDICAL_INTERN: 'Apoyo en la atención y registro de signos vitales.',
  NURSE: 'Cuidados de enfermería y apoyo a la atención.',
  LAB_TECHNICIAN: 'Estudios y resultados de laboratorio.',
  RECEPTIONIST: 'Admisión de pacientes y coordinación de citas.',
  BILLING_CLERK: 'Emisión de facturas, cupones y puntos.',
  BILLING_SUPERVISOR: 'Revisión y anulación de facturas.',
  MARKETING_MANAGER: 'Campañas, anuncios y beneficios del centro.',
  PATIENT: 'Autorización de accesos a sus datos y consulta de anuncios.',
  DEVOPS: 'Operación de servidores y bases de datos.',
};

export function rolePurpose(role: Role): string {
  return (
    PURPOSES[role.code] ??
    role.description ??
    'Configura las funciones que podrá realizar este rol.'
  );
}

export function roleName(code: string, roles: readonly Role[] = []): string {
  return roles.find((role) => role.code === code)?.name ?? ROLE[code] ?? 'Rol personalizado';
}

export function roleCategory(role: Role): 'care' | 'administration' | 'other' {
  if (
    ['PHYSICIAN', 'MEDICAL_INTERN', 'NURSE', 'LAB_TECHNICIAN', 'RECEPTIONIST'].includes(role.code)
  )
    return 'care';
  if (role.system && !['PATIENT', 'DEVOPS'].includes(role.code)) return 'administration';
  return 'other';
}

export function roleIcon(role: Role): IconName {
  if (roleCategory(role) === 'care')
    return role.code === 'LAB_TECHNICIAN'
      ? 'flask'
      : role.code === 'RECEPTIONIST'
        ? 'calendar'
        : 'stethoscope';
  if (role.code.startsWith('BILLING')) return 'receipt';
  if (role.code.includes('AUDITOR')) return 'file-signature';
  if (role.code === 'MARKETING_MANAGER') return 'megaphone';
  if (role.code === 'PATIENT') return 'user';
  if (role.code === 'DEVOPS') return 'settings';
  return 'shield-check';
}

export function areaId(permission: CatalogPermission): string {
  const code = permission.code;
  if (code.startsWith('patients.')) return 'patients';
  if (code.startsWith('clinical.')) return 'clinical';
  if (code.startsWith('scheduling.') || code.startsWith('professionals.')) return 'scheduling';
  if (code.startsWith('documents.')) return 'documents';
  if (code.startsWith('billing.') || /^marketing\.(promotion|coupon|loyalty_)/.test(code))
    return 'billing';
  if (code.startsWith('marketing.')) return 'marketing';
  if (code.startsWith('notifications.')) return 'notifications';
  if (code.startsWith('tenancy.')) return 'organization';
  if (code.startsWith('identity.') || code.startsWith('audit.')) return 'security';
  if (code.startsWith('catalogs.')) return 'catalogs';
  return 'infrastructure';
}

const RESOURCES: Readonly<Record<string, string>> = {
  'identity.user': 'cuentas de usuario',
  'identity.role': 'roles',
  'identity.permission': 'accesos',
  'identity.clearance': 'autorizaciones de información',
  'tenancy.organization': 'organizaciones',
  'tenancy.branch': 'sucursales',
  'tenancy.service_offering': 'prestaciones y tarifas',
  'tenancy.subscription': 'suscripciones',
  'tenancy.plan': 'planes disponibles',
  'tenancy.usage': 'consumo del plan',
  'catalogs.icd10': 'diagnósticos de referencia',
  'catalogs.medication': 'medicamentos de referencia',
  'catalogs.specialty': 'especialidades',
  'catalogs.study_type': 'tipos de estudio',
  'catalogs.tax': 'información fiscal',
  'patients.patient': 'fichas de pacientes',
  'patients.merge': 'pacientes duplicados',
  'patients.access_grant': 'accesos entre centros',
  'patients.self_access': 'accesos a mis datos',
  'patients.notification_preference': 'preferencias de contacto',
  'professionals.professional': 'profesionales de salud',
  'professionals.affiliation': 'vínculos con el centro',
  'scheduling.appointment': 'citas',
  'scheduling.availability': 'disponibilidad',
  'scheduling.block': 'bloqueos de agenda',
  'scheduling.reservation': 'reservas',
  'scheduling.resource': 'consultorios y equipos',
  'clinical.record': 'expedientes',
  'clinical.narrative': 'notas clínicas confidenciales',
  'clinical.encounter': 'atenciones',
  'clinical.addendum': 'aclaraciones clínicas',
  'clinical.allergy': 'alergias',
  'clinical.background': 'antecedentes',
  'clinical.diagnosis': 'diagnósticos',
  'clinical.procedure': 'procedimientos',
  'clinical.prescription': 'recetas',
  'clinical.study_order': 'órdenes de estudio',
  'clinical.study_result': 'resultados de estudios',
  'clinical.vital_sign': 'signos vitales',
  'documents.document': 'documentos clínicos',
  'documents.consent': 'consentimientos',
  'documents.consent_template': 'plantillas de consentimiento',
  'billing.invoice': 'facturas',
  'notifications.template': 'plantillas de mensajes',
  'notifications.rule': 'reglas de envío',
  'notifications.notification': 'notificaciones',
  'notifications.whatsapp': 'mensajes de WhatsApp',
  'audit.log': 'actividad del sistema',
  'marketing.campaign': 'campañas',
  'marketing.recipient': 'destinatarios de campañas',
  'marketing.segment': 'grupos de destinatarios',
  'marketing.promotion': 'promociones',
  'marketing.coupon': 'cupones',
  'marketing.advertisement': 'anuncios',
  'marketing.loyalty_program': 'programas de puntos',
  'marketing.loyalty_account': 'saldos de puntos',
  'marketing.loyalty_movement': 'movimientos de puntos',
  'marketing.patient_activity': 'actividad comercial',
  'marketing.opt_out': 'bajas de comunicaciones',
  'infrastructure.server': 'servidores',
  'infrastructure.database': 'bases de datos',
};

const ACTIONS: Readonly<Record<string, string>> = {
  read: 'Consultar',
  create: 'Registrar',
  update: 'Modificar',
  change_status: 'Cambiar el estado de',
  deactivate: 'Desactivar',
  delete: 'Eliminar',
  open: 'Abrir',
  sign: 'Firmar',
  void: 'Anular',
  read_history: 'Consultar el historial de',
  upload: 'Subir',
  download: 'Descargar',
  classify: 'Clasificar',
  link: 'Vincular',
  generate: 'Generar',
  publish: 'Publicar',
  reject: 'Rechazar',
  issue: 'Emitir',
  subscribe: 'Contratar',
  record: 'Registrar',
  confirm: 'Confirmar',
  request: 'Solicitar',
  revoke: 'Revocar',
  cancel: 'Cancelar',
  reschedule: 'Reprogramar',
  attend: 'Registrar la atención de',
  no_show: 'Registrar inasistencias de',
  check_in: 'Registrar la llegada a',
  release: 'Liberar',
  mark_in_use: 'Marcar en uso',
  schedule: 'Programar',
  schedule_collection: 'Programar la toma de muestras de',
  attach_document: 'Adjuntar documentos a',
  update_notes: 'Escribir notas de',
  share: 'Compartir',
  request_otp: 'Enviar un código de autorización para',
  dispatch: 'Enviar',
  retry: 'Reintentar el envío de',
  send: 'Enviar',
  export: 'Descargar informes de',
  verify: 'Verificar la integridad de',
  view: 'Ver',
  track: 'Registrar interacciones con',
  launch: 'Iniciar',
  pause: 'Pausar',
  finish: 'Finalizar',
  build_audience: 'Preparar los destinatarios de',
  evaluate: 'Evaluar',
  redeem: 'Canjear',
  validate: 'Validar',
  manage: 'Administrar',
};

const LABELS: Readonly<Record<string, string>> = {
  'scheduling.appointment.attend': 'Marcar citas como atendidas',
  'scheduling.appointment.check_in': 'Registrar la llegada del paciente',
  'scheduling.appointment.no_show': 'Registrar inasistencias a citas',
  'scheduling.reservation.mark_in_use': 'Marcar recursos como ocupados',
  'clinical.study_order.schedule_collection': 'Programar la toma de muestras',
  'clinical.record.change_status': 'Activar o cerrar expedientes',
  'clinical.record.share': 'Compartir expedientes con autorización',
  'documents.consent.request_otp': 'Enviar un código para autorizar el consentimiento',
  'marketing.advertisement.track': 'Registrar interacciones con anuncios',
  'marketing.campaign.build_audience': 'Preparar los destinatarios de una campaña',

  'identity.user.create': 'Dar de alta usuarios',
  'identity.user.update': 'Modificar los datos de usuarios',
  'identity.user.change_status': 'Dar de baja o reactivar usuarios',
  'identity.user.unlock': 'Desbloquear cuentas',
  'identity.user.reset': 'Restablecer contraseñas',
  'identity.role.assign': 'Cambiar los roles del personal',
  'identity.role.assign_initial': 'Elegir un rol al dar de alta a una persona',
  'identity.role.manage': 'Crear y modificar roles',
  'identity.permission.grant': 'Definir los accesos de otros roles',
  'identity.clearance.manage': 'Autorizar el acceso a información reservada',
  'clinical.record.read': 'Consultar expedientes',
  'clinical.record.create': 'Abrir expedientes',
  'clinical.encounter.open': 'Registrar una atención',
  'clinical.encounter.sign': 'Firmar atenciones',
  'clinical.encounter.update_notes': 'Escribir las notas de una atención',
  'clinical.narrative.read': 'Leer notas clínicas confidenciales',
  'patients.merge.create': 'Unificar fichas duplicadas',
  'patients.merge.read': 'Consultar unificaciones de fichas',
  'patients.access_grant.request': 'Solicitar acceso a otro centro',
  'patients.access_grant.confirm': 'Confirmar el acceso con autorización del paciente',
  'patients.access_grant.revoke': 'Revocar el acceso de otro centro',
  'patients.access_grant.read': 'Consultar los accesos entre centros',
  'patients.self_access.read': 'Consultar quién solicita acceso a mis datos',
  'patients.self_access.confirm': 'Autorizar el acceso a mis datos',
  'patients.self_access.revoke': 'Retirar el acceso a mis datos',
  'billing.invoice.void': 'Anular facturas',
  'audit.log.read_platform': 'Consultar la actividad de todos los centros',
};

const PRIORITY = [
  'clinical.record.read',
  'clinical.encounter.open',
  'clinical.encounter.sign',
  'clinical.narrative.read',
];

export function permissionLabel(permission: CatalogPermission): string {
  if (LABELS[permission.code]) return LABELS[permission.code];
  const index = permission.code.lastIndexOf('.');
  const resource = RESOURCES[permission.code.slice(0, index)];
  const verb = ACTIONS[permission.code.slice(index + 1)];
  if (resource && verb) return `${verb} ${resource}`;
  return (
    permission.description.replace(/\([^)]*(?:RBAC|ISO|IAM|JWT|MAC|DAC)[^)]*\)/gi, '').trim() ||
    'Función adicional'
  );
}

export function permissionHint(permission: CatalogPermission): string | null {
  if (permission.code === 'clinical.narrative.read')
    return 'Incluye información reservada del paciente.';
  if (permission.code === 'billing.invoice.void')
    return 'Permite anular una factura, conservando el comprobante.';
  if (permission.code === 'identity.role.assign_initial')
    return 'Se aplica solo al crear una cuenta; no cambia los roles actuales.';
  if (permission.code === 'audit.log.read_platform')
    return 'Incluye la actividad de todas las organizaciones.';
  return null;
}

export function accessAreas(catalog: readonly CatalogPermission[]): readonly AccessArea[] {
  return AREAS.map(([id, name, description, icon]) => ({
    id,
    name,
    description,
    icon,
    permissions: catalog
      .filter((permission) => areaId(permission) === id)
      .sort((a, b) => {
        const rank = (code: string) => {
          const position = PRIORITY.indexOf(code);
          return position < 0 ? PRIORITY.length : position;
        };
        return (
          rank(a.code) - rank(b.code) || permissionLabel(a).localeCompare(permissionLabel(b), 'es')
        );
      }),
  })).filter((area) => area.permissions.length > 0);
}

export function searchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

export function accessFailure(
  failure: unknown,
  roles: readonly Role[],
  catalog: readonly CatalogPermission[] = [],
): string {
  let message = describeFailure(failure).message;
  if (message.includes('; se configura con PUT /roles/'))
    return 'No puedes asignar este rol. Pide al responsable de accesos que revise los roles que puedes asignar.';
  if (/Ya existe un rol con el codigo/i.test(message))
    return 'Este rol ya existe. Actualiza la lista de roles antes de volver a intentarlo.';
  const names: Record<string, string> = {
    ...ROLE,
    PUBLIC: 'Público',
    INTERNAL: 'Interno',
    CONFIDENTIAL: 'Confidencial',
    RESTRICTED: 'Restringido',
    ...Object.fromEntries(roles.map((role) => [role.code, role.name])),
  };
  message = message.replace(/\b[A-Z][A-Z0-9_]+\b/g, (code) => names[code] ?? code);
  message = message.replace(/[a-z]+\.[a-z0-9_]+\.[a-z_]+/g, (code) => {
    const permission = catalog.find((entry) => entry.code === code);
    return permission
      ? permissionLabel(permission).toLocaleLowerCase('es')
      : 'la función solicitada';
  });
  return message
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, 'seleccionada')
    .replace(/^Segregacion de funciones:\s*/i, 'Para separar responsabilidades, ');
}
