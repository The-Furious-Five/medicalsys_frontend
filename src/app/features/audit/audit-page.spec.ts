import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuditPage } from './audit-page';
import type { AuditIntegrity, AuditPage as AuditPageModel, AuditSummary } from './audit-event';

const SUMMARY: AuditSummary = {
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-07T00:00:00Z',
  totalEvents: 3,
  deniedEvents: 1,
  failedEvents: 0,
  criticalEvents: 1,
  byCategory: [{ key: 'CLINICAL_RECORD', total: 2 }],
  byOutcome: [
    { key: 'SUCCESS', total: 2 },
    { key: 'DENIED', total: 1 },
  ],
  bySeverity: [{ key: 'CRITICAL', total: 1 }],
  byService: [{ key: 'ms-historial', total: 2 }],
  topActors: [{ actorUserId: 'a-1', actorDisplayName: 'Medico Demo', total: 2 }],
};

const INTEGRITY: AuditIntegrity = {
  fromSequenceNumber: 1,
  toSequenceNumber: 3,
  verifiedEvents: 3,
  intact: true,
  detail: 'El tramo verificado encadena correctamente',
  verifiedAt: '2026-09-07T12:00:00Z',
};

const EVENTS: AuditPageModel = {
  content: [
    {
      eventId: '11111111-1111-4111-8111-111111111111',
      sequenceNumber: 3,
      occurredAt: '2026-09-07T09:00:00Z',
      recordedAt: '2026-09-07T09:00:01Z',
      serviceName: 'ms-historial',
      action: 'MEDICAL_RECORD_VIEWED',
      category: 'AUTHORIZATION',
      severity: 'CRITICAL',
      outcome: 'DENIED',
      actorDisplayName: 'Recepcion Demo',
      actorRoles: ['RECEPTIONIST'],
      resourceType: 'MEDICAL_RECORD',
      correlationId: '147c87d8-e5f4-4d24-a760-4974f8897a0c',
      responseStatus: 403,
      reason: 'El rol RECEPTIONIST no puede leer expedientes',
      recordHash: 'a'.repeat(64),
    },
  ],
  page: 0,
  size: 25,
  totalElements: 1,
  totalPages: 1,
};

const EMPTY_EVENTS: AuditPageModel = {
  content: [],
  page: 0,
  size: 25,
  totalElements: 0,
  totalPages: 0,
};

describe('AuditPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Las tres consultas iniciales solo consumen el gateway, nunca el puerto del microservicio. */
  it('should query summary, events and integrity through the gateway on load', () => {
    const fixture = TestBed.createComponent(AuditPage);
    fixture.detectChanges();

    const requests = http.match((request) => request.url.startsWith('/api/v1/audit'));

    expect(requests.map((request) => request.request.url)).toEqual([
      '/api/v1/audit/summary',
      '/api/v1/audit/events',
      '/api/v1/audit/integrity',
    ]);
    requests[0].flush(SUMMARY);
    requests[1].flush(EVENTS);
    requests[2].flush(INTEGRITY);
  });

  it('should render one row per event with its outcome spelled out', async () => {
    const fixture = TestBed.createComponent(AuditPage);
    fixture.detectChanges();

    http.expectOne((request) => request.url === '/api/v1/audit/summary').flush(SUMMARY);
    http.expectOne((request) => request.url === '/api/v1/audit/events').flush(EVENTS);
    http.expectOne((request) => request.url === '/api/v1/audit/integrity').flush(INTEGRITY);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
    // El resultado no se comunica solo con color: la etiqueta lo dice con palabras.
    expect(element.textContent).toContain('Denegada');
    expect(element.textContent).toContain('MEDICAL_RECORD_VIEWED');
  });

  it('should show an empty state instead of a blank table when nothing matches', async () => {
    const fixture = TestBed.createComponent(AuditPage);
    fixture.detectChanges();

    http.expectOne((request) => request.url === '/api/v1/audit/summary').flush(SUMMARY);
    http.expectOne((request) => request.url === '/api/v1/audit/events').flush(EMPTY_EVENTS);
    http.expectOne((request) => request.url === '/api/v1/audit/integrity').flush(INTEGRITY);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.empty')).not.toBeNull();
    expect(element.querySelector('table')).toBeNull();
  });

  /**
   * Un 403 tiene que explicarse y ofrecer el correlationId.
   *
   * Es el error más probable de esta pantalla: la bitácora solo la puede leer administración, y sin
   * el identificador copiable nadie puede rastrear la misma operación en el gateway.
   */
  it('should surface the common API error with a copyable correlation id', async () => {
    const fixture = TestBed.createComponent(AuditPage);
    fixture.detectChanges();

    http.expectOne((request) => request.url === '/api/v1/audit/summary').flush(SUMMARY);
    http
      .expectOne((request) => request.url === '/api/v1/audit/events')
      .flush(
        {
          timestamp: '2026-09-07T12:00:00Z',
          status: 403,
          code: 'FORBIDDEN',
          message: 'El rol de la identidad autenticada no permite consultar la bitacora',
          correlationId: '147c87d8-e5f4-4d24-a760-4974f8897a0c',
          path: '/api/v1/audit/events',
        },
        { status: 403, statusText: 'Forbidden' },
      );
    http.expectOne((request) => request.url === '/api/v1/audit/integrity').flush(INTEGRITY);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.banner--error')?.textContent).toContain('FORBIDDEN');
    expect(element.querySelector('.banner--error')?.textContent).toContain(
      '147c87d8-e5f4-4d24-a760-4974f8897a0c',
    );
  });
});
