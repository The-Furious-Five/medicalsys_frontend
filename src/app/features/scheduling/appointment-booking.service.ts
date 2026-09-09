import { Injectable, inject } from '@angular/core';
import { PatientsService } from '../patients/patients.service';
import { Appointment, CreateAppointmentInput } from './scheduling.models';
import { SchedulingService } from './scheduling.service';

/** Error local y explicable: todavía no se ha enviado nada al backend de Agenda. */
export class AppointmentNotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentNotificationValidationError';
  }
}

/**
 * Coordina las dos decisiones tomadas en el formulario de alta de cita.
 *
 * Agenda sigue siendo la única responsable de crear la cita y publicar su
 * evento Kafka. El frontend únicamente registra el consentimiento explícito
 * que ms-notificaciones exige antes de despachar el WhatsApp.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentBookingService {
  private readonly scheduling = inject(SchedulingService);
  private readonly patients = inject(PatientsService);

  async create(body: CreateAppointmentInput, authorizeWhatsapp: boolean): Promise<Appointment> {
    if (authorizeWhatsapp) {
      const patient = await this.patients.get(body.patientPublicId);
      if (patient.phoneE164 === null || patient.phoneE164.trim() === '') {
        throw new AppointmentNotificationValidationError(
          'El paciente no tiene un número de WhatsApp. Registra un teléfono en formato internacional o desactiva el aviso.',
        );
      }

      await this.patients.setNotificationPreference(body.patientPublicId, 'WHATSAPP', 'CLINICAL', {
        optIn: true,
        consentSource: 'RECEPTION',
      });
    }

    return this.scheduling.create(body);
  }
}
