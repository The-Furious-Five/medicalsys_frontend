import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientsService } from '../patients/patients.service';
import { Patient } from '../patients/patients.models';
import { CreateAppointmentInput } from './scheduling.models';
import { SchedulingService } from './scheduling.service';
import {
  AppointmentBookingService,
  AppointmentNotificationValidationError,
} from './appointment-booking.service';

describe('AppointmentBookingService', () => {
  const patients = {
    get: vi.fn(),
    setNotificationPreference: vi.fn(),
  };
  const scheduling = { create: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        AppointmentBookingService,
        { provide: PatientsService, useValue: patients },
        { provide: SchedulingService, useValue: scheduling },
      ],
    });
  });

  it('crea la cita directamente cuando no se solicitó WhatsApp', async () => {
    scheduling.create.mockResolvedValue({ publicId: 'appointment-1' });

    await TestBed.inject(AppointmentBookingService).create(appointment(), false);

    expect(patients.get).not.toHaveBeenCalled();
    expect(patients.setNotificationPreference).not.toHaveBeenCalled();
    expect(scheduling.create).toHaveBeenCalledWith(appointment());
  });

  it('registra el consentimiento antes de enviar la cita a Agenda', async () => {
    patients.get.mockResolvedValue(patient('+59170000001'));
    patients.setNotificationPreference.mockResolvedValue({ optIn: true });
    scheduling.create.mockResolvedValue({ publicId: 'appointment-1' });

    await TestBed.inject(AppointmentBookingService).create(appointment(), true);

    expect(patients.setNotificationPreference).toHaveBeenCalledWith(
      'patient-1',
      'WHATSAPP',
      'CLINICAL',
      { optIn: true, consentSource: 'RECEPTION' },
    );
    expect(patients.setNotificationPreference.mock.invocationCallOrder[0]).toBeLessThan(
      scheduling.create.mock.invocationCallOrder[0],
    );
    expect(scheduling.create).toHaveBeenCalledWith(appointment());
  });

  it('no crea la cita con aviso cuando el paciente no tiene teléfono', async () => {
    patients.get.mockResolvedValue(patient(null));

    await expect(
      TestBed.inject(AppointmentBookingService).create(appointment(), true),
    ).rejects.toBeInstanceOf(AppointmentNotificationValidationError);

    expect(patients.setNotificationPreference).not.toHaveBeenCalled();
    expect(scheduling.create).not.toHaveBeenCalled();
  });
});

function appointment(): CreateAppointmentInput {
  return {
    organizationPublicId: 'organization-1',
    branchPublicId: 'branch-1',
    patientPublicId: 'patient-1',
    healthProfessionalPublicId: 'professional-1',
    serviceOfferingPublicId: 'offering-1',
    startsAt: '2026-09-09T09:00:00-04:00',
    endsAt: '2026-09-09T09:30:00-04:00',
  };
}

function patient(phoneE164: string | null): Patient {
  return {
    patientId: 'patient-1',
    userAccountId: null,
    documentType: 'CI',
    documentNumber: '123',
    documentComplement: '',
    givenNames: 'Ana',
    paternalSurname: 'Demo',
    maternalSurname: null,
    fullName: 'Demo Ana',
    birthDate: '1990-01-01',
    sex: 'F',
    phoneE164,
    alternatePhone: null,
    email: null,
    city: null,
    department: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelationship: null,
    status: 'ACTIVE',
    createdAt: '2026-09-08T00:00:00Z',
    updatedAt: '2026-09-08T00:00:00Z',
  };
}
