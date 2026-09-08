import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import {
  Advertisement,
  Campaign,
  CampaignPerformance,
  CampaignRecipient,
  CampaignSummary,
  CouponValidation,
  CreateAdvertisementInput,
  CreateCampaignInput,
  CreateLoyaltyProgramInput,
  CreatePromotionInput,
  CreateSegmentInput,
  LoyaltyBalance,
  LoyaltyMovement,
  LoyaltyMovementInput,
  LoyaltyProgram,
  MaterializedAudience,
  PatientActivity,
  Promotion,
  Segment,
  SegmentCriteria,
  SegmentPreview,
  UpdateSegmentInput,
  ValidateCouponInput,
} from './marketing.models';

/**
 * ms-marketing.
 *
 * Sigue la misma división que el resto de servicios: las lecturas son
 * `httpResource` —exponen `value`, `isLoading`, `error` y `reload`, que son
 * justo los estados que cada vista dibuja— y las escrituras van por `HttpClient`
 * devolviendo una promesa, porque quien las lanza necesita esperar el resultado
 * para cerrar su formulario o navegar.
 *
 * Las rutas están en español porque así las publica el servicio; los campos JSON
 * van en inglés `camelCase`. Ninguna llamada envía `organizationId`: lo impone el
 * gateway desde el JWT.
 */
@Injectable({ providedIn: 'root' })
export class MarketingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ------------------------------------------------------------ segmentos -- */

  segmentsResource(active: Signal<boolean | null>, page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<Segment>>(() => ({
        url: `${this.baseUrl}/segmentos`,
        params: {
          size,
          page: page(),
          ...(active() === null ? {} : { active: active()! }),
        },
      })),
    );
  }

  segmentResource(segmentId: Signal<string | null>) {
    return dataResource(
      httpResource<Segment>(() => {
        const id = segmentId();
        return id ? `${this.baseUrl}/segmentos/${id}` : undefined;
      }),
    );
  }

  createSegment(body: CreateSegmentInput): Promise<Segment> {
    return firstValueFrom(this.http.post<Segment>(`${this.baseUrl}/segmentos`, body));
  }

  updateSegment(segmentId: string, body: UpdateSegmentInput): Promise<Segment> {
    return firstValueFrom(this.http.patch<Segment>(`${this.baseUrl}/segmentos/${segmentId}`, body));
  }

  /**
   * Evalúa un criterio sin guardarlo.
   *
   * Es lo que evita el error caro: ver a cuánta gente alcanza antes de crear la
   * campaña, cuando todavía se puede corregir. Una campaña lanzada no se recoge.
   */
  previewCriteria(criteria: SegmentCriteria): Promise<SegmentPreview> {
    return firstValueFrom(
      this.http.post<SegmentPreview>(`${this.baseUrl}/segmentos/vista-previa`, criteria),
    );
  }

  evaluateSegment(segmentId: string): Promise<SegmentPreview> {
    return firstValueFrom(
      this.http.post<SegmentPreview>(`${this.baseUrl}/segmentos/${segmentId}/evaluacion`, {}),
    );
  }

  deactivateSegment(segmentId: string): Promise<Segment> {
    return firstValueFrom(
      this.http.post<Segment>(`${this.baseUrl}/segmentos/${segmentId}/desactivacion`, {}),
    );
  }

  deleteSegment(segmentId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/segmentos/${segmentId}`));
  }

  /* ------------------------------------------------------------- campañas -- */

  campaignsResource(status: Signal<string | null>, page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<CampaignSummary>>(() => ({
        url: `${this.baseUrl}/campanas`,
        params: { size, page: page(), ...(status() ? { status: status()! } : {}) },
      })),
    );
  }

  campaignResource(campaignId: Signal<string | null>) {
    return dataResource(
      httpResource<Campaign>(() => {
        const id = campaignId();
        return id ? `${this.baseUrl}/campanas/${id}` : undefined;
      }),
    );
  }

  performanceResource(campaignId: Signal<string | null>) {
    return dataResource(
      httpResource<CampaignPerformance>(() => {
        const id = campaignId();
        return id ? `${this.baseUrl}/campanas/${id}/rendimiento` : undefined;
      }),
    );
  }

  recipientsResource(
    campaignId: Signal<string | null>,
    status: Signal<string | null>,
    page: Signal<number>,
    size = 25,
  ) {
    return dataResource(
      httpResource<Page<CampaignRecipient>>(() => {
        const id = campaignId();
        if (!id) {
          return undefined;
        }
        return {
          url: `${this.baseUrl}/campanas/${id}/destinatarios`,
          params: { size, page: page(), ...(status() ? { status: status()! } : {}) },
        };
      }),
    );
  }

  createCampaign(body: CreateCampaignInput): Promise<Campaign> {
    return firstValueFrom(this.http.post<Campaign>(`${this.baseUrl}/campanas`, body));
  }

  /** Congela quién recibirá la campaña y quién queda excluido, con su motivo. */
  materializeAudience(campaignId: string): Promise<MaterializedAudience> {
    return firstValueFrom(
      this.http.post<MaterializedAudience>(`${this.baseUrl}/campanas/${campaignId}/audiencia`, {}),
    );
  }

  /**
   * Transiciones del ciclo de vida.
   *
   * Cada una es una ruta propia y no un `PATCH status`: el servicio decide si la
   * transición es válida, y nombrarlas por separado deja claro en el registro de
   * red qué se pidió exactamente.
   */
  scheduleCampaign = (id: string) => this.transition(id, 'programacion');
  launchCampaign = (id: string) => this.transition(id, 'lanzamiento');
  pauseCampaign = (id: string) => this.transition(id, 'pausa');
  finishCampaign = (id: string) => this.transition(id, 'finalizacion');
  cancelCampaign = (id: string) => this.transition(id, 'cancelacion');

  private transition(campaignId: string, action: string): Promise<Campaign> {
    return firstValueFrom(
      this.http.post<Campaign>(`${this.baseUrl}/campanas/${campaignId}/${action}`, {}),
    );
  }

  /* ---------------------------------------------------------- promociones -- */

  promotionsResource(active: Signal<boolean | null>, page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<Promotion>>(() => ({
        url: `${this.baseUrl}/promociones`,
        params: {
          size,
          page: page(),
          ...(active() === null ? {} : { active: active()! }),
        },
      })),
    );
  }

  createPromotion(body: CreatePromotionInput): Promise<Promotion> {
    return firstValueFrom(this.http.post<Promotion>(`${this.baseUrl}/promociones`, body));
  }

  deactivatePromotion(promotionId: string): Promise<Promotion> {
    return firstValueFrom(
      this.http.post<Promotion>(`${this.baseUrl}/promociones/${promotionId}/desactivacion`, {}),
    );
  }

  /** Comprueba un cupón sin consumirlo: mostrar el descuento no puede gastarlo. */
  validateCoupon(body: ValidateCouponInput): Promise<CouponValidation> {
    return firstValueFrom(
      this.http.post<CouponValidation>(`${this.baseUrl}/promociones/validar`, body),
    );
  }

  /* ------------------------------------------------------------- anuncios -- */

  advertisementsResource(page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<Advertisement>>(() => ({
        url: `${this.baseUrl}/anuncios`,
        params: { size, page: page() },
      })),
    );
  }

  createAdvertisement(body: CreateAdvertisementInput): Promise<Advertisement> {
    return firstValueFrom(this.http.post<Advertisement>(`${this.baseUrl}/anuncios`, body));
  }

  publishAdvertisement = (id: string) => this.advertisementAction(id, 'publicacion');
  pauseAdvertisement = (id: string) => this.advertisementAction(id, 'pausa');
  finishAdvertisement = (id: string) => this.advertisementAction(id, 'finalizacion');

  private advertisementAction(advertisementId: string, action: string): Promise<Advertisement> {
    return firstValueFrom(
      this.http.post<Advertisement>(`${this.baseUrl}/anuncios/${advertisementId}/${action}`, {}),
    );
  }

  /* ------------------------------------------------------------ fidelidad -- */

  loyaltyProgramsResource() {
    return dataResource(
      httpResource<readonly LoyaltyProgram[]>(() => `${this.baseUrl}/fidelidad/programas`),
    );
  }

  createLoyaltyProgram(body: CreateLoyaltyProgramInput): Promise<LoyaltyProgram> {
    return firstValueFrom(
      this.http.post<LoyaltyProgram>(`${this.baseUrl}/fidelidad/programas`, body),
    );
  }

  deactivateLoyaltyProgram(programId: string): Promise<LoyaltyProgram> {
    return firstValueFrom(
      this.http.post<LoyaltyProgram>(
        `${this.baseUrl}/fidelidad/programas/${programId}/desactivacion`,
        {},
      ),
    );
  }

  /** Sin `programId` el servicio usa el programa activo del centro. */
  balanceResource(patientId: Signal<string | null>) {
    return dataResource(
      httpResource<LoyaltyBalance>(() => {
        const id = patientId();
        if (!id) {
          return undefined;
        }
        return { url: `${this.baseUrl}/fidelidad/saldo`, params: { patientId: id } };
      }),
    );
  }

  movementsResource(patientId: Signal<string | null>, page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<LoyaltyMovement>>(() => {
        const id = patientId();
        if (!id) {
          return undefined;
        }
        return {
          url: `${this.baseUrl}/fidelidad/movimientos`,
          params: { patientId: id, size, page: page() },
        };
      }),
    );
  }

  registerMovement(body: LoyaltyMovementInput): Promise<LoyaltyMovement> {
    return firstValueFrom(
      this.http.post<LoyaltyMovement>(`${this.baseUrl}/fidelidad/movimientos`, body),
    );
  }

  /* -------------------------------------------------- actividad comercial -- */

  activityResource(page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<PatientActivity>>(() => ({
        url: `${this.baseUrl}/pacientes/actividad`,
        params: { size, page: page() },
      })),
    );
  }

  patientActivityResource(patientId: Signal<string | null>) {
    return dataResource(
      httpResource<PatientActivity>(() => {
        const id = patientId();
        return id ? `${this.baseUrl}/pacientes/${id}/actividad` : undefined;
      }),
    );
  }

  /**
   * Registra o revoca la exclusión comercial.
   *
   * Vive en marketing y no en la ficha del paciente por dos motivos del propio
   * servicio: la exclusión se evalúa al materializar la audiencia —antes de que
   * exista mensaje alguno— y debe poder ejercerse aunque ms-pacientes esté caído.
   */
  setOptOut(patientId: string, optOut: boolean): Promise<PatientActivity> {
    return firstValueFrom(
      this.http.put<PatientActivity>(`${this.baseUrl}/pacientes/${patientId}/opt-out`, { optOut }),
    );
  }
}
