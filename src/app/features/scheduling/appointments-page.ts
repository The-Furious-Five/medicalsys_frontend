import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { todayIso } from '../../core/format/format';
import { APPOINTMENT_STATUS, MODALITY, options } from '../../core/labels/labels';
import { appointmentTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientName } from '../patients/patient-name';
import { ProfessionalsService } from '../professionals/professionals.service';
import { AppointmentSheet } from './appointment-sheet';
import { NewAppointmentSeed, NewAppointmentSheet } from './new-appointment-sheet';
import { SchedulingService } from './scheduling.service';
import { clinicInstant, durationLabel, durationMinutes } from './scheduling.time';

/**
 * Bandeja de citas.
 *
 * El tablero responde a «qué pasa hoy»; esta lista responde a «dónde está
 * aquella cita». Por eso aquí manda la búsqueda —persona, profesional, estado y
 * rango de fechas— y no la hora del día.
 */
@Component({
  selector: 'medsys-appointments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    DateField,
    Icon,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    PatientName,
    AppointmentSheet,
    NewAppointmentSheet,
    ...FORMAT_PIPES,
  ],
  templateUrl: './appointments-page.html',
})
export class AppointmentsPage {
  private readonly scheduling = inject(SchedulingService);
  private readonly professionals = inject(ProfessionalsService);

  protected readonly appointmentStatuses = APPOINTMENT_STATUS;
  protected readonly appointmentTones = appointmentTone;
  protected readonly modalities = MODALITY;
  protected readonly statusOptions = options(APPOINTMENT_STATUS);

  protected readonly status = signal<string | null>(null);
  protected readonly professional = signal<string | null>(null);
  protected readonly patient = signal<string | null>(null);
  protected readonly from = signal(todayIso());
  protected readonly to = signal('');
  protected readonly page = signal(0);

  protected readonly detailId = signal<string | null>(null);
  protected readonly seed = signal<NewAppointmentSeed | null>(null);

  private readonly range = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!from && !to) {
      return null;
    }
    return {
      from: clinicInstant(from || '1970-01-01', '00:00'),
      to: clinicInstant(to || '2999-12-31', '23:59'),
    };
  });

  protected readonly list = this.scheduling.appointmentSearchResource({
    page: this.page,
    status: this.status,
    professionalId: this.professional,
    patientId: this.patient,
    range: this.range,
  });

  private readonly staff = this.professionals.professionalsResource();
  protected readonly professionalOptions = computed(
    () => this.staff.value()?.map((person) => ({ value: person.id, label: person.fullName })) ?? [],
  );
  private readonly staffNames = computed(() => {
    const names = new Map<string, string>();
    for (const person of this.staff.value() ?? []) {
      names.set(person.id, person.fullName);
    }
    return names;
  });

  protected readonly hasFilters = computed(
    () => this.status() !== null || this.professional() !== null || this.to() !== '',
  );

  protected professionalName(id: string): string {
    return this.staffNames().get(id) ?? 'Sin identificar';
  }

  protected duration(startsAt: string, endsAt: string): string {
    return durationLabel(durationMinutes(startsAt, endsAt));
  }

  protected resetFilters(): void {
    this.status.set(null);
    this.professional.set(null);
    this.to.set('');
    this.page.set(0);
  }

  protected open(appointmentId: string): void {
    this.detailId.set(appointmentId);
  }

  protected onRowKey(event: KeyboardEvent, appointmentId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(appointmentId);
    }
  }

  protected newAppointment(): void {
    this.seed.set({ professionalId: this.professional(), date: todayIso(), time: null });
  }

  protected onSaved(): void {
    this.seed.set(null);
    this.list.reload();
  }
}
