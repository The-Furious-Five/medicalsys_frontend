import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import {
  Branch,
  BranchInput,
  OfferingInput,
  Organization,
  PlanUsage,
  ServiceOffering,
  Subscription,
} from './tenancy.models';

/**
 * ms-tenencia.
 *
 * Las lecturas son `httpResource`: exponen `value`, `isLoading`, `error` y
 * `reload`, que son exactamente los estados que cada vista tiene que dibujar.
 * Las escrituras van por `HttpClient` y devuelven una promesa, porque el
 * componente necesita esperar el resultado para cerrar su formulario.
 */
@Injectable({ providedIn: 'root' })
export class TenancyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ------------------------------------------------------------ lecturas -- */

  organizationResource(enabled?: Signal<boolean>) {
    return dataResource(
      httpResource<Organization>(() =>
        enabled && !enabled() ? undefined : `${this.baseUrl}/tenancy/organizacion`,
      ),
    );
  }

  branchesResource(status?: Signal<string | null>) {
    return dataResource(
      httpResource<Page<Branch>>(() => ({
        url: `${this.baseUrl}/tenancy/sucursales`,
        params: { size: 50, ...(status?.() ? { status: status()! } : {}) },
      })),
    );
  }

  offeringsResource(active?: Signal<boolean | null>, enabled?: Signal<boolean>) {
    return dataResource(
      httpResource<Page<ServiceOffering>>(() => {
        if (enabled && !enabled()) return undefined;
        const isActive = active?.();
        return {
          url: `${this.baseUrl}/tenancy/prestaciones`,
          params: {
            size: 100,
            ...(isActive === null || isActive === undefined ? {} : { active: isActive }),
          },
        };
      }),
    );
  }

  subscriptionResource() {
    return dataResource(httpResource<Subscription>(() => `${this.baseUrl}/tenancy/suscripcion`));
  }

  usageResource(enabled?: Signal<boolean>) {
    return dataResource(
      httpResource<readonly PlanUsage[]>(
        () => (enabled && !enabled() ? undefined : `${this.baseUrl}/tenancy/consumo`),
        {
          defaultValue: [],
        },
      ),
    );
  }

  /* ----------------------------------------------------------- escrituras - */

  updateOrganization(body: Record<string, unknown>): Promise<Organization> {
    return firstValueFrom(
      this.http.put<Organization>(`${this.baseUrl}/tenancy/organizacion`, body),
    );
  }

  createBranch(body: BranchInput): Promise<Branch> {
    return firstValueFrom(this.http.post<Branch>(`${this.baseUrl}/tenancy/sucursales`, body));
  }

  updateBranch(branchId: string, body: BranchInput): Promise<Branch> {
    return firstValueFrom(
      this.http.put<Branch>(`${this.baseUrl}/tenancy/sucursales/${branchId}`, body),
    );
  }

  changeBranchStatus(branchId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<Branch> {
    return firstValueFrom(
      this.http.patch<Branch>(`${this.baseUrl}/tenancy/sucursales/${branchId}/estado`, { status }),
    );
  }

  createOffering(body: OfferingInput): Promise<ServiceOffering> {
    return firstValueFrom(
      this.http.post<ServiceOffering>(`${this.baseUrl}/tenancy/prestaciones`, body),
    );
  }

  updateOffering(offeringId: string, body: OfferingInput): Promise<ServiceOffering> {
    return firstValueFrom(
      this.http.put<ServiceOffering>(`${this.baseUrl}/tenancy/prestaciones/${offeringId}`, body),
    );
  }

  changeOfferingActive(offeringId: string, active: boolean): Promise<ServiceOffering> {
    return firstValueFrom(
      this.http.patch<ServiceOffering>(
        `${this.baseUrl}/tenancy/prestaciones/${offeringId}/vigencia`,
        { active },
      ),
    );
  }
}
