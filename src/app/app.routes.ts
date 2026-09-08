import { Routes } from '@angular/router';
import { authGuard, permissionGuard, publicOnlyGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'acceso',
    title: 'MSYS · Acceso',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'MSYS · Inicio',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },

      /* --------------------------------------------------------- agenda -- */
      {
        path: 'agenda',
        title: 'MSYS · Agenda',
        canActivate: [permissionGuard('viewSchedule')],
        loadComponent: () => import('./features/scheduling/agenda-page').then((m) => m.AgendaPage),
      },
      {
        path: 'citas',
        title: 'MSYS · Citas',
        canActivate: [permissionGuard('viewSchedule')],
        loadComponent: () =>
          import('./features/scheduling/appointments-page').then((m) => m.AppointmentsPage),
      },
      {
        path: 'disponibilidad',
        title: 'MSYS · Disponibilidad',
        canActivate: [permissionGuard('manageAvailability')],
        loadComponent: () =>
          import('./features/scheduling/availability-page').then((m) => m.AvailabilityPage),
      },
      {
        path: 'recursos',
        title: 'MSYS · Recursos',
        canActivate: [permissionGuard('manageResources')],
        loadComponent: () =>
          import('./features/scheduling/resources-page').then((m) => m.ResourcesPage),
      },

      /* ------------------------------------------------------- historial -- */
      {
        path: 'pacientes',
        title: 'MSYS · Pacientes',
        canActivate: [permissionGuard('viewPatients')],
        loadComponent: () =>
          import('./features/patients/patients-page').then((m) => m.PatientsPage),
      },
      {
        path: 'pacientes/:patientId',
        title: 'MSYS · Ficha del paciente',
        canActivate: [permissionGuard('viewPatients')],
        loadComponent: () =>
          import('./features/patients/patient-detail-page').then((m) => m.PatientDetailPage),
      },
      {
        path: 'expedientes',
        title: 'MSYS · Expedientes',
        canActivate: [permissionGuard('viewRecords')],
        loadComponent: () =>
          import('./features/medical-records/records-page').then((m) => m.RecordsPage),
      },
      {
        path: 'expedientes/:recordId',
        title: 'MSYS · Expediente',
        canActivate: [permissionGuard('viewRecords')],
        loadComponent: () =>
          import('./features/medical-records/record-detail-page').then((m) => m.RecordDetailPage),
      },
      {
        path: 'encuentros',
        title: 'MSYS · Encuentros',
        canActivate: [permissionGuard('viewRecords')],
        loadComponent: () =>
          import('./features/medical-records/encounters-page').then((m) => m.EncountersPage),
      },
      {
        path: 'encuentros/:encounterId',
        title: 'MSYS · Encuentro clínico',
        canActivate: [permissionGuard('viewRecords')],
        loadComponent: () =>
          import('./features/medical-records/encounter-page').then((m) => m.EncounterPage),
      },
      {
        path: 'ordenes-estudio',
        title: 'MSYS · Órdenes de estudio',
        canActivate: [permissionGuard('manageStudyOrders')],
        loadComponent: () =>
          import('./features/medical-records/study-orders-page').then((m) => m.StudyOrdersPage),
      },
      {
        path: 'ordenes-estudio/:orderId',
        title: 'MSYS · Orden de estudio',
        canActivate: [permissionGuard('manageStudyOrders')],
        loadComponent: () =>
          import('./features/medical-records/study-order-detail-page').then(
            (m) => m.StudyOrderDetailPage,
          ),
      },

      /* ---------------------------------------------------- profesionales -- */
      {
        path: 'profesionales',
        title: 'MSYS · Profesionales',
        canActivate: [permissionGuard('viewProfessionals')],
        loadComponent: () =>
          import('./features/professionals/professionals-page').then((m) => m.ProfessionalsPage),
      },
      {
        path: 'profesionales/:professionalId',
        title: 'MSYS · Ficha del profesional',
        canActivate: [permissionGuard('viewProfessionals')],
        loadComponent: () =>
          import('./features/professionals/professional-detail-page').then(
            (m) => m.ProfessionalDetailPage,
          ),
      },

      /* ----------------------------------------------------- facturación -- */
      {
        path: 'facturas',
        pathMatch: 'full',
        title: 'MSYS · Facturas',
        canActivate: [permissionGuard('viewInvoices')],
        loadComponent: () => import('./features/billing/invoices-page').then((m) => m.InvoicesPage),
      },
      {
        path: 'facturas/nueva',
        title: 'MSYS · Emitir factura',
        canActivate: [permissionGuard('issueInvoice')],
        loadComponent: () =>
          import('./features/billing/new-invoice-page').then((m) => m.NewInvoicePage),
      },
      {
        path: 'facturas/:invoiceId',
        title: 'MSYS · Factura',
        canActivate: [permissionGuard('viewInvoices')],
        loadComponent: () =>
          import('./features/billing/invoice-detail-page').then((m) => m.InvoiceDetailPage),
      },

      /* ------------------------------------------------------- marketing -- */
      {
        path: 'campanas',
        pathMatch: 'full',
        title: 'MSYS · Campañas',
        canActivate: [permissionGuard('viewMarketing')],
        loadComponent: () =>
          import('./features/marketing/campaigns-page').then((m) => m.CampaignsPage),
      },
      {
        path: 'campanas/nueva',
        title: 'MSYS · Nueva campaña',
        canActivate: [permissionGuard('manageMarketing')],
        loadComponent: () =>
          import('./features/marketing/new-campaign-page').then((m) => m.NewCampaignPage),
      },
      {
        path: 'campanas/:campaignId',
        title: 'MSYS · Campaña',
        canActivate: [permissionGuard('viewMarketing')],
        loadComponent: () =>
          import('./features/marketing/campaign-detail-page').then((m) => m.CampaignDetailPage),
      },
      {
        path: 'segmentos',
        title: 'MSYS · Segmentos',
        canActivate: [permissionGuard('viewMarketing')],
        loadComponent: () =>
          import('./features/marketing/segments-page').then((m) => m.SegmentsPage),
      },
      {
        path: 'promociones',
        title: 'MSYS · Cupones',
        canActivate: [permissionGuard('viewCoupons')],
        loadComponent: () =>
          import('./features/marketing/promotions-page').then((m) => m.PromotionsPage),
      },
      {
        path: 'anuncios',
        title: 'MSYS · Anuncios',
        canActivate: [permissionGuard('viewMarketing')],
        loadComponent: () =>
          import('./features/marketing/advertisements-page').then((m) => m.AdvertisementsPage),
      },
      {
        path: 'fidelidad',
        title: 'MSYS · Fidelización',
        canActivate: [permissionGuard('viewLoyalty')],
        loadComponent: () => import('./features/marketing/loyalty-page').then((m) => m.LoyaltyPage),
      },
      {
        path: 'actividad-comercial',
        title: 'MSYS · Actividad comercial',
        canActivate: [permissionGuard('viewMarketing')],
        loadComponent: () =>
          import('./features/marketing/activity-page').then((m) => m.ActivityPage),
      },

      /* -------------------------------------------------------- tenencia -- */
      {
        path: 'organizacion',
        title: 'MSYS · Organización',
        canActivate: [permissionGuard('viewOrganization')],
        loadComponent: () =>
          import('./features/tenancy/organization-page').then((m) => m.OrganizationPage),
      },
      {
        path: 'prestaciones',
        title: 'MSYS · Prestaciones',
        canActivate: [permissionGuard('viewOrganization')],
        loadComponent: () =>
          import('./features/tenancy/offerings-page').then((m) => m.OfferingsPage),
      },
      {
        path: 'suscripcion',
        title: 'MSYS · Plan y consumo',
        canActivate: [permissionGuard('viewSubscription')],
        loadComponent: () =>
          import('./features/tenancy/subscription-page').then((m) => m.SubscriptionPage),
      },

      {
        path: 'configuracion',
        title: 'MSYS · Configuración',
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },

      {
        path: 'sin-permiso',
        title: 'MSYS · Sin permiso',
        loadComponent: () => import('./shared/access-denied-page').then((m) => m.AccessDeniedPage),
      },
      {
        path: '**',
        loadComponent: () => import('./shared/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
