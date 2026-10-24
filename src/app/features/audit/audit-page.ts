import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuditApi } from './audit-api';
import {
  AUDIT_CATEGORIES,
  AUDIT_OUTCOMES,
  AUDIT_SEVERITIES,
  categoryLabel,
  outcomeLabel,
  severityLabel,
} from './audit-event';
import type {
  AuditEvent,
  AuditFilters,
  AuditIntegrity,
  AuditPage as AuditPageModel,
  AuditSummary,
} from './audit-event';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { isApiError } from '../../core/http/api-error';
import type { ApiError } from '../../core/http/api-error';
import { DateTimeField } from '../../shared/datetime-field';
import { Select } from '../../shared/select';

/** Estado de una petición de la pantalla, para no confundir "sin datos" con "todavía cargando". */
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const PAGE_SIZE = 25;

@Component({
  selector: 'medsys-audit-page',
  imports: [DatePipe, ReactiveFormsModule, DateTimeField, Select],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage {
  private readonly api = inject(AuditApi);
  private readonly formBuilder = inject(FormBuilder);
  private readonly session = inject(AuthSession);

  /** OSI: ve la bitácora de todas las organizaciones y puede acotarla a una. */
  protected readonly platformScope = computed(() =>
    can.viewPlatformAudit(this.session.permissions()),
  );

  protected readonly categories = AUDIT_CATEGORIES;
  protected readonly outcomes = AUDIT_OUTCOMES;
  protected readonly severities = AUDIT_SEVERITIES;

  /* El desplegable propio recibe la lista ya construida; el `<select>` nativo la
     armaba con un `@for` de `<option>` que el sistema operativo dibujaba a su
     manera. */
  protected readonly categoryOptions = AUDIT_CATEGORIES.map((value) => ({
    value,
    label: categoryLabel(value),
  }));
  protected readonly outcomeOptions = AUDIT_OUTCOMES.map((value) => ({
    value,
    label: outcomeLabel(value),
  }));
  protected readonly severityOptions = AUDIT_SEVERITIES.map((value) => ({
    value,
    label: severityLabel(value),
  }));

  protected readonly categoryLabel = categoryLabel;
  protected readonly outcomeLabel = outcomeLabel;
  protected readonly severityLabel = severityLabel;

  /**
   * Filtros de la búsqueda.
   *
   * Las fechas se capturan como `datetime-local` —lo que el auditor entiende— y se convierten a
   * ISO con zona antes de salir. La organización viene del JWT; solo el OSI la puede elegir.
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    organizationId: '',
    from: '',
    to: '',
    category: '',
    outcome: '',
    severity: '',
    serviceName: '',
    action: '',
    actorUserId: '',
    patientId: '',
    correlationId: '',
    q: '',
  });

  protected readonly eventsState = signal<LoadState>('idle');
  protected readonly summaryState = signal<LoadState>('idle');
  protected readonly integrityState = signal<LoadState>('idle');
  protected readonly exportState = signal<LoadState>('idle');

  protected readonly events = signal<AuditPageModel | null>(null);
  protected readonly summary = signal<AuditSummary | null>(null);
  protected readonly integrity = signal<AuditIntegrity | null>(null);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly selectedEventId = signal<string | null>(null);
  protected readonly copiedValue = signal<string | null>(null);

  protected readonly rows = computed(() => this.events()?.content ?? []);
  protected readonly currentPage = computed(() => this.events()?.page ?? 0);
  protected readonly totalPages = computed(() => this.events()?.totalPages ?? 0);
  protected readonly totalElements = computed(() => this.events()?.totalElements ?? 0);
  protected readonly isEmpty = computed(
    () => this.eventsState() === 'loaded' && this.rows().length === 0,
  );

  constructor() {
    this.loadSummary();
    this.loadEvents(0);
    this.loadIntegrity();
  }

  protected applyFilters(): void {
    this.loadSummary();
    this.loadEvents(0);
    this.loadIntegrity();
  }

  protected clearFilters(): void {
    this.filters.reset();
    this.applyFilters();
  }

  protected goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) {
      return;
    }
    this.loadEvents(page);
  }

  /** Alterna el detalle de una fila; solo una queda abierta para no perder el contexto de la tabla. */
  protected toggleDetail(eventId: string): void {
    this.selectedEventId.update((current) => (current === eventId ? null : eventId));
  }

  protected loadIntegrity(): void {
    this.integrityState.set('loading');
    this.api.integrity(undefined, this.currentFilters().organizationId).subscribe({
      next: (report) => {
        this.integrity.set(report);
        this.integrityState.set('loaded');
      },
      error: (failure: HttpErrorResponse) => {
        this.integrityState.set('error');
        this.captureError(failure);
      },
    });
  }

  protected exportCsv(): void {
    this.exportState.set('loading');
    this.api.exportCsv(this.currentFilters()).subscribe({
      next: (blob) => {
        this.download(blob);
        this.exportState.set('loaded');
      },
      error: (failure: HttpErrorResponse) => {
        this.exportState.set('error');
        this.captureError(failure);
      },
    });
  }

  /** Copia un identificador para pegarlo en un ticket o buscarlo en los logs del gateway. */
  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedValue.set(value);
    } catch {
      // Sin permiso de portapapeles el valor sigue visible y seleccionable en pantalla.
      this.copiedValue.set(null);
    }
  }

  protected dismissError(): void {
    this.error.set(null);
  }

  private loadEvents(page: number): void {
    this.eventsState.set('loading');
    this.selectedEventId.set(null);
    this.api.search(this.currentFilters(), page, PAGE_SIZE).subscribe({
      next: (result) => {
        this.events.set(result);
        this.eventsState.set('loaded');
      },
      error: (failure: HttpErrorResponse) => {
        this.eventsState.set('error');
        this.captureError(failure);
      },
    });
  }

  private loadSummary(): void {
    this.summaryState.set('loading');
    const { from, to, organizationId } = this.currentFilters();
    this.api.summary(from, to, organizationId).subscribe({
      next: (result) => {
        this.summary.set(result);
        this.summaryState.set('loaded');
      },
      error: (failure: HttpErrorResponse) => {
        this.summaryState.set('error');
        this.captureError(failure);
      },
    });
  }

  private currentFilters(): AuditFilters {
    const value = this.filters.getRawValue();
    return {
      organizationId: this.platformScope() ? blankToUndefined(value.organizationId) : undefined,
      from: toIsoInstant(value.from),
      to: toIsoInstant(value.to),
      category: value.category === '' ? undefined : (value.category as AuditFilters['category']),
      outcome: value.outcome === '' ? undefined : (value.outcome as AuditFilters['outcome']),
      severity: value.severity === '' ? undefined : (value.severity as AuditFilters['severity']),
      serviceName: blankToUndefined(value.serviceName),
      action: blankToUndefined(value.action),
      actorUserId: blankToUndefined(value.actorUserId),
      patientId: blankToUndefined(value.patientId),
      correlationId: blankToUndefined(value.correlationId),
      q: blankToUndefined(value.q),
    };
  }

  /**
   * Traduce el fallo HTTP al error común del MVP.
   *
   * Cuando el cuerpo no cumple el contrato —una caída de red, un 502 del proxy— se construye un
   * error equivalente en vez de mostrar el objeto crudo: al usuario no le sirve un stack trace.
   */
  private captureError(failure: HttpErrorResponse): void {
    if (isApiError(failure.error)) {
      this.error.set(failure.error);
      return;
    }
    this.error.set({
      timestamp: new Date().toISOString(),
      status: failure.status,
      code: failure.status === 0 ? 'NETWORK_UNAVAILABLE' : 'UNEXPECTED_ERROR',
      message:
        failure.status === 0
          ? 'No se pudo contactar el gateway. Verifica que la plataforma esté disponible.'
          : 'La bitácora respondió con un error inesperado.',
      correlationId: '',
      path: failure.url ?? '',
    });
  }

  private download(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medicalsys-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected isSelected(event: AuditEvent): boolean {
    return this.selectedEventId() === event.eventId;
  }
}

/**
 * Convierte un valor de `datetime-local` a ISO con zona.
 *
 * El control entrega hora local sin zona; el contrato exige ISO-8601 con zona. Enviar el valor tal
 * cual desplazaría la ventana consultada tantas horas como el huso del navegador.
 */
function toIsoInstant(localDateTime: string): string | undefined {
  if (localDateTime.trim() === '') {
    return undefined;
  }
  const parsed = new Date(localDateTime);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
