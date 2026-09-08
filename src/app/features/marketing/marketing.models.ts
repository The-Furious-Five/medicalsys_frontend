/**
 * ms-marketing · `/api/v1/{campanas,segmentos,promociones,anuncios,fidelidad}`.
 *
 * Este servicio es el que **menos** sabe del sistema, y sus tipos lo enseñan:
 * no hay ningún campo de diagnóstico, alergia ni expediente porque su base no
 * tiene ninguna columna donde ponerlo. La única «historia» que conoce de un
 * paciente es comercial —cuándo vino y cuánto gastó— y vive en
 * {@link PatientActivity}.
 *
 * Los importes llegan como número (el servicio serializa `BigDecimal` así), no
 * como cadena: `msBob` acepta ambos, pero tipar el real evita conversiones
 * innecesarias en las vistas.
 */

/* ------------------------------------------------------------- segmentos -- */

/**
 * Criterio de segmentación. **Esta es la frontera de privacidad del servicio.**
 *
 * Los trece campos son la lista blanca completa: no existe forma de expresar un
 * criterio clínico porque no hay campo donde escribirlo. El backend rechaza con
 * `422 CLINICAL_DATA_NOT_ALLOWED` cualquier eje que no esté aquí, así que la
 * interfaz no ofrece ninguno más: pedir algo que el servicio va a rechazar sería
 * hacer trabajar al usuario para nada.
 */
export interface SegmentCriteria {
  readonly minAge?: number | null;
  readonly maxAge?: number | null;
  readonly sex?: readonly string[] | null;
  readonly cities?: readonly string[] | null;
  readonly lastVisitBefore?: string | null;
  readonly lastVisitAfter?: string | null;
  readonly minAppointments?: number | null;
  readonly maxNoShows?: number | null;
  readonly minTotalBilledBob?: number | null;
  readonly lastServiceOfferingId?: string | null;
  readonly birthdayMonth?: number | null;
  readonly controlDueBefore?: string | null;
  readonly excludeCampaignId?: string | null;
}

export interface Segment {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly criteria: SegmentCriteria;
  /** Invariante del servicio: siempre `false`. Se muestra como prueba, no como opción. */
  readonly usesClinicalData: boolean;
  readonly estimatedSize: number | null;
  readonly lastEvaluatedAt: string | null;
  readonly active: boolean;
  readonly createdAt: string;
}

/** Miembro de una audiencia evaluada: identificador, nombre y resultado. Nada más. */
export interface AudienceMember {
  readonly patientId: string;
  readonly fullName: string | null;
  readonly status: string;
  readonly exclusionReason: string | null;
}

export interface SegmentPreview {
  readonly matched: number;
  readonly reachable: number;
  readonly optedOut: number;
  readonly sample: readonly AudienceMember[];
  readonly evaluatedAt: string;
}

export interface CreateSegmentInput {
  readonly name: string;
  readonly description: string | null;
  readonly criteria: SegmentCriteria;
}

export interface UpdateSegmentInput {
  readonly description?: string | null;
  readonly criteria?: SegmentCriteria;
}

/* -------------------------------------------------------------- campañas -- */

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly objective: string | null;
  readonly channel: string;
  readonly messageTemplateId: string | null;
  readonly segmentId: string | null;
  readonly segmentName: string | null;
  readonly promotionId: string | null;
  readonly couponCode: string | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly budgetBob: number | null;
  readonly status: string;
  readonly totalRecipients: number;
  readonly totalSent: number;
  readonly totalRead: number;
  readonly totalConverted: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignSummary {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly startsAt: string;
  readonly totalRecipients: number;
  readonly totalConverted: number;
}

/** Tasas calculadas por la vista `v_campaign_performance` de la base. */
export interface CampaignPerformance {
  readonly campaignId: string;
  readonly name: string;
  readonly status: string;
  readonly totalRecipients: number;
  readonly totalSent: number;
  readonly totalRead: number;
  readonly totalConverted: number;
  readonly sendRatePct: number | null;
  readonly readRatePct: number | null;
  readonly conversionRatePct: number | null;
  readonly excludedOptOut: number;
}

export interface CampaignRecipient {
  readonly patientId: string;
  readonly fullName: string | null;
  readonly status: string;
  readonly exclusionReason: string | null;
  readonly notificationId: string | null;
  readonly generatedAppointmentId: string | null;
  readonly evaluatedAt: string;
}

/**
 * Resultado de congelar la audiencia.
 *
 * `excludedOptOut` no es un descarte silencioso: son destinatarios registrados
 * con su motivo, y esa cifra es lo que se consulta cuando alguien reclama haber
 * recibido un mensaje que no quería.
 */
export interface MaterializedAudience {
  readonly campaignId: string;
  readonly matched: number;
  readonly reachable: number;
  readonly excludedOptOut: number;
  readonly truncated: boolean;
  readonly materializedAt: string;
}

export interface CreateCampaignInput {
  readonly name: string;
  readonly type: string;
  readonly objective: string | null;
  readonly channel: string;
  readonly segmentId: string | null;
  readonly promotionId: string | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly budgetBob: number | null;
}

/* ----------------------------------------------------------- promociones -- */

export interface Promotion {
  readonly id: string;
  readonly couponCode: string;
  readonly name: string;
  readonly description: string | null;
  readonly discountType: string;
  readonly value: number;
  readonly serviceOfferingId: string | null;
  readonly maxRedemptions: number | null;
  readonly redemptionsPerPatient: number;
  readonly currentRedemptions: number;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface CreatePromotionInput {
  readonly couponCode: string;
  readonly name: string;
  readonly description: string | null;
  readonly discountType: string;
  readonly value: number;
  readonly serviceOfferingId: string | null;
  readonly maxRedemptions: number | null;
  readonly redemptionsPerPatient: number;
  readonly validFrom: string;
  readonly validUntil: string;
}

/**
 * Resultado de validar un cupón.
 *
 * Un cupón que no aplica responde `200` con `valid: false` y su motivo, no un
 * error: para quien cobra, «este cupón no sirve» es una respuesta del flujo, no
 * un fallo de la petición.
 */
export interface CouponValidation {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly promotionId: string | null;
  readonly couponCode: string;
  readonly discountType: string | null;
  readonly discountAmountBob: number;
  readonly netAmountBob: number;
}

export interface ValidateCouponInput {
  readonly couponCode: string;
  readonly patientId: string;
  readonly serviceOfferingId: string | null;
  readonly baseAmountBob: number;
}

/* -------------------------------------------------------------- anuncios -- */

export interface Advertisement {
  readonly id: string;
  /** Un anuncio institucional es de la plataforma: se ve en todos los tenants y no se edita. */
  readonly institutional: boolean;
  readonly title: string;
  readonly content: string | null;
  readonly imageDocumentId: string | null;
  readonly targetUrl: string | null;
  readonly serviceOfferingId: string | null;
  readonly placement: string;
  readonly priority: number;
  readonly targetAudience: Record<string, unknown> | null;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly status: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly createdAt: string;
}

export interface CreateAdvertisementInput {
  readonly title: string;
  readonly content: string | null;
  readonly targetUrl: string | null;
  readonly serviceOfferingId: string | null;
  readonly placement: string;
  readonly priority: number;
  readonly validFrom: string;
  readonly validUntil: string;
}

/* ------------------------------------------------------------- fidelidad -- */

export interface LoyaltyProgram {
  readonly id: string;
  readonly name: string;
  /** Puntos que otorga cada boliviano facturado. */
  readonly pointsPerBob: number;
  /** Valor en bolivianos de cada punto al canjearlo. */
  readonly bobPerPoint: number;
  readonly pointsValidityMonths: number | null;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface CreateLoyaltyProgramInput {
  readonly name: string;
  readonly pointsPerBob: number;
  readonly bobPerPoint: number;
  readonly pointsValidityMonths: number | null;
}

export interface LoyaltyBalance {
  readonly patientId: string;
  readonly fullName: string | null;
  readonly programId: string;
  readonly programName: string;
  readonly balancePoints: number;
  readonly balanceValueBob: number;
  readonly lastMovementAt: string | null;
}

export interface LoyaltyMovement {
  readonly id: string;
  readonly patientId: string;
  readonly type: string;
  readonly points: number;
  readonly resultingBalance: number;
  readonly valueBob: number;
  readonly invoiceId: string | null;
  readonly appointmentId: string | null;
  readonly reason: string | null;
  readonly occurredAt: string;
}

/**
 * Asiento registrado a mano.
 *
 * `points` va siempre en positivo y el tipo decide el signo. `ACCRUAL` no se
 * admite por esta vía: la acumulación llega por evento desde ms-facturacion con
 * su clave de idempotencia, y permitirla a mano abriría la puerta a otorgar dos
 * veces los puntos de una misma factura.
 */
export interface LoyaltyMovementInput {
  readonly patientId: string;
  readonly type: 'REDEMPTION' | 'MANUAL_ADJUSTMENT' | 'REFERRAL_BONUS' | 'EXPIRATION';
  readonly points: number;
  readonly reason: string | null;
}

/* --------------------------------------------------- actividad comercial -- */

/**
 * Proyección comercial del paciente.
 *
 * Merece leerse entero por lo que **no** tiene: hay fechas, contadores e
 * importes, y ni un solo campo que diga por qué el paciente vino.
 * `suggestedNextVisitOn` es la fecha del control que llega en el evento del
 * expediente —nunca su motivo—: marketing sabe cuándo volver a llamar, no de
 * qué padece la persona.
 */
export interface PatientActivity {
  readonly patientId: string;
  readonly fullName: string | null;
  readonly firstVisitOn: string | null;
  readonly lastVisitOn: string | null;
  readonly totalAppointments: number;
  readonly totalNoShows: number;
  readonly totalBilledBob: number;
  readonly lastServiceOfferingId: string | null;
  readonly lastServiceOfferingName: string | null;
  readonly suggestedNextVisitOn: string | null;
  readonly marketingOptOut: boolean;
  readonly updatedAt: string;
}
