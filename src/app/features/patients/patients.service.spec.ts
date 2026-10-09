import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('envía el consentimiento de WhatsApp al contrato de ms-pacientes', async () => {
    const { service, http } = setup();
    const pending = service.setNotificationPreference('patient-1', 'WHATSAPP', 'CLINICAL', {
      optIn: true,
      consentSource: 'RECEPTION',
    });

    const request = http.expectOne(
      '/api/v1/patients/patient-1/notification-preferences/WHATSAPP/CLINICAL',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ optIn: true, consentSource: 'RECEPTION' });
    request.flush({
      patientId: 'patient-1',
      channel: 'WHATSAPP',
      category: 'CLINICAL',
      optIn: true,
      consentSource: 'RECEPTION',
      optInAt: '2026-09-08T20:00:00Z',
      optOutAt: null,
      updatedAt: '2026-09-08T20:00:00Z',
    });

    await expect(pending).resolves.toMatchObject({ optIn: true });
  });
});

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), PatientsService],
  });
  return {
    service: TestBed.inject(PatientsService),
    http: TestBed.inject(HttpTestingController),
  };
}
