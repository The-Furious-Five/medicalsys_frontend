/**
 * ms-tenencia · contratos de `/api/v1/tenancy/**`.
 *
 * Los tipos reproducen los `record` de Java uno a uno. Nada se inventa: si un
 * campo no está aquí, es que el backend no lo devuelve.
 */

export type Department =
  | 'LA_PAZ'
  | 'COCHABAMBA'
  | 'SANTA_CRUZ'
  | 'ORURO'
  | 'POTOSI'
  | 'CHUQUISACA'
  | 'TARIJA'
  | 'BENI'
  | 'PANDO';

export interface Organization {
  readonly id: string;
  readonly code: string;
  readonly type: string;
  readonly legalName: string;
  readonly tradeName: string;
  readonly nit: string;
  readonly tradeRegistryNumber: string | null;
  readonly contactEmail: string;
  readonly phoneE164: string | null;
  readonly city: string | null;
  readonly department: Department | null;
  readonly timeZone: string;
  readonly currency: string;
  readonly logoUrl: string | null;
  readonly status: 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Branch {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly headquarters: boolean;
  readonly address: string;
  readonly city: string;
  readonly department: Department;
  readonly phoneE164: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly openingHours: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ServiceOffering {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: string;
  readonly specialtyCode: string | null;
  readonly durationMinutes: number | null;
  readonly basePriceBob: string;
  readonly requiresConsent: boolean;
  readonly consentTemplatePublicId: string | null;
  readonly requiredResourceType: string | null;
  readonly taxProductCode: string | null;
  readonly taxUnitCode: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SubscriptionPlan {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly monthlyPriceBob: string;
  readonly maxUsers: number | null;
  readonly maxBranches: number | null;
  readonly maxStorageGb: number | null;
  readonly includesWhatsapp: boolean;
  readonly includesBilling: boolean;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface Subscription {
  readonly id: number;
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly billingCycle: 'MONTHLY' | 'YEARLY';
  readonly startDate: string;
  readonly endDate: string | null;
  readonly agreedPriceBob: string;
  readonly status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  readonly effective: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlanUsage {
  readonly organizationId: string;
  readonly metric: 'USERS' | 'BRANCHES' | 'STORAGE_BYTES';
  readonly currentValue: number;
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly exceeded: boolean;
  readonly periodStart: string;
  readonly periodEnd: string | null;
  readonly updatedAt: string;
}

export interface BranchInput {
  readonly code?: string;
  readonly name: string;
  readonly headquarters?: boolean;
  readonly address: string;
  readonly city: string;
  readonly department: Department;
  readonly phoneE164: string | null;
  readonly openingHours: string | null;
}

export interface OfferingInput {
  readonly code?: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: string;
  readonly specialtyCode: string | null;
  readonly durationMinutes: number | null;
  readonly basePriceBob: string;
  readonly requiresConsent: boolean;
  readonly requiredResourceType: string | null;
  readonly taxProductCode: string | null;
  readonly taxUnitCode: string | null;
}
