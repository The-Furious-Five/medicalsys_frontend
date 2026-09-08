import { Permission, Roles, can } from '../core/auth/permissions';
import { IconName } from '../core/ui/icon';

export interface NavItem {
  readonly link: string;
  readonly label: string;
  readonly icon: IconName;
  readonly permission: Permission;
  readonly exact?: boolean;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string | null;
  readonly items: readonly NavItem[];
}

/**
 * Modelo de la navegación.
 *
 * El menú muestra únicamente lo que el rol activo puede usar. Nada aparece
 * visible y deshabilitado «para que se vea completo»: enseñar puertas cerradas
 * no ayuda a nadie a hacer su trabajo.
 */
const NAV: readonly NavGroup[] = [
  {
    id: 'inicio',
    label: null,
    items: [
      {
        link: '/',
        label: 'Inicio',
        icon: 'layout-dashboard',
        permission: 'viewOrganization',
        exact: true,
      },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    items: [
      { link: '/agenda', label: 'Agenda', icon: 'calendar', permission: 'viewSchedule' },
      { link: '/citas', label: 'Citas', icon: 'clipboard-list', permission: 'viewSchedule' },
      {
        link: '/disponibilidad',
        label: 'Disponibilidad',
        icon: 'clock',
        permission: 'manageAvailability',
      },
      { link: '/recursos', label: 'Recursos', icon: 'building', permission: 'manageResources' },
    ],
  },
  {
    id: 'historial',
    label: 'Historial clínico',
    items: [
      { link: '/pacientes', label: 'Pacientes', icon: 'users', permission: 'viewPatients' },
      { link: '/expedientes', label: 'Expedientes', icon: 'file-text', permission: 'viewRecords' },
      { link: '/encuentros', label: 'Encuentros', icon: 'stethoscope', permission: 'viewRecords' },
      {
        link: '/ordenes-estudio',
        label: 'Órdenes de estudio',
        icon: 'flask',
        permission: 'manageStudyOrders',
      },
    ],
  },
  {
    id: 'profesionales',
    label: 'Profesionales',
    items: [
      {
        link: '/profesionales',
        label: 'Directorio',
        icon: 'stethoscope',
        permission: 'viewProfessionals',
      },
    ],
  },
  {
    id: 'facturacion',
    label: 'Facturación',
    items: [{ link: '/facturas', label: 'Facturas', icon: 'receipt', permission: 'viewInvoices' }],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { link: '/campanas', label: 'Campañas', icon: 'megaphone', permission: 'viewMarketing' },
      { link: '/segmentos', label: 'Segmentos', icon: 'target', permission: 'viewMarketing' },
      { link: '/promociones', label: 'Cupones', icon: 'ticket', permission: 'viewCoupons' },
      { link: '/anuncios', label: 'Anuncios', icon: 'monitor', permission: 'viewMarketing' },
      { link: '/fidelidad', label: 'Fidelización', icon: 'gift', permission: 'viewLoyalty' },
      {
        link: '/actividad-comercial',
        label: 'Actividad comercial',
        icon: 'activity',
        permission: 'viewMarketing',
      },
    ],
  },
  {
    // Grupo propio y no dentro de «Historial clínico»: el catálogo lo consultan
    // también recepción al citar y caja al cobrar, no solo quien diagnostica.
    id: 'referencia',
    label: 'Referencia',
    items: [
      {
        link: '/catalogos',
        label: 'Catálogos clínicos',
        icon: 'pill',
        permission: 'viewCatalogs',
      },
    ],
  },
  {
    id: 'tenencia',
    label: 'Organización',
    items: [
      {
        link: '/organizacion',
        label: 'Datos y sucursales',
        icon: 'building',
        permission: 'viewOrganization',
      },
      {
        link: '/prestaciones',
        label: 'Prestaciones',
        icon: 'wallet',
        permission: 'viewOrganization',
      },
      {
        link: '/suscripcion',
        label: 'Plan y consumo',
        icon: 'gauge',
        permission: 'viewSubscription',
      },
    ],
  },
];

export function visibleNav(roles: Roles): readonly NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can[item.permission](roles)),
  })).filter((group) => group.items.length > 0);
}
