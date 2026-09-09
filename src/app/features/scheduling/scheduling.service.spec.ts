import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthSession } from '../../core/auth/auth-session';
import { CreateAppointmentInput } from './scheduling.models';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('envía a Agenda el contrato completo necesario para crear la cita', async () => {
    const { service, http } = setup();
    const body: CreateAppointmentInput = {
      organizationPublicId: 'organization-1',
      branchPublicId: 'branch-1',
      patientPublicId: 'patient-1',
      healthProfessionalPublicId: 'professional-1',
      serviceOfferingPublicId: 'offering-1',
      startsAt: '2026-09-09T09:00:00-04:00',
      endsAt: '2026-09-09T09:30:00-04:00',
      modality: 'IN_PERSON',
      channelOrigin: 'RECEPTION',
      reasonForVisit: 'Control',
      requiresConsent: false,
      estimatedPriceBob: '150.00',
      teleconsultationLink: null,
      physicalResourcePublicId: 'resource-1',
    };

    const pending = service.create(body);
    const request = http.expectOne('/api/v1/scheduling/appointments');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ...body,
      createdByUserPublicId: 'user-1',
    });
    request.flush({ publicId: 'appointment-1' });

    await expect(pending).resolves.toMatchObject({ publicId: 'appointment-1' });
  });
});

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      SchedulingService,
      {
        provide: AuthSession,
        useValue: {
          user: signal({
            publicId: 'user-1',
            organizationPublicId: 'organization-1',
          }),
        },
      },
    ],
  });
  return {
    service: TestBed.inject(SchedulingService),
    http: TestBed.inject(HttpTestingController),
  };
}
