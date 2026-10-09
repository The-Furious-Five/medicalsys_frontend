import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import {
  APPOINTMENT_STATUS,
  CHANNEL_ORIGIN,
  MODALITY,
  STATUS_CHANGE_ORIGIN,
  label,
} from '../../core/labels/labels';
import { AppointmentStatus, appointmentTone } from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { Dialog } from '../../shared/dialog';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { PatientName } from '../patients/patient-name';
import { ProfessionalsService, activeLink } from '../professionals/professionals.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { Slot } from './scheduling.models';
import { SchedulingService, StatusAction } from './scheduling.service';
import { NumberField } from '../../shared/number-field';
import { TimeField } from '../../shared/time-field';
import {
  clinicDate,
  clinicInstant,
  clinicTime,
  durationLabel,
  durationMinutes,
} from './scheduling.time';

/** Cada destino con el verbo que se usa en el mostrador, no el nombre del enum. */
const ACTIONS: Record<StatusAction, { readonly label: string; readonly danger: boolean }> = {
  CONFIRMED: { label: 'Confirmar cita', danger: false },
  WAITING: { label: 'Registrar llegada', danger: false },
  IN_PROGRESS: { label: 'Iniciar atención', danger: false },
  ATTENDED: { label: 'Marcar como atendida', danger: false },
  NO_SHOW: { label: 'No asistió', danger: true },
  CANCELLED: { label: 'Cancelar cita', danger: true },
};

/** Los dos destinos que cierran la cita sin atenderla piden explicación: sin
 *  ella nadie sabrá después por qué esa franja quedó vacía. */
const NEEDS_REASON: readonly StatusAction[] = ['CANCELLED', 'NO_SHOW'];

/**
 * Detalle de una cita.
 *
 * Ofrece solo las transiciones que el backend declara en `allowedTransitions`:
 * un botón que va a devolver 409 es una trampa. Reprogramar vive aparte porque
 * no es un cambio de estado — crea una cita nueva y deja la anterior marcada—,
 * y esa diferencia importa cuando alguien busca después qué pasó con la hora
 * original.
 */
@Component({
  selector: 'medsys-appointment-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Dialog,
    StatusChip,
    Notice,
    Icon,
    Skeleton,
    ErrorState,
    DateField,
    PatientName,
    ...FORMAT_PIPES,
    NumberField,
    TimeField,
  ],
  templateUrl: './appointment-sheet.html',
})
export class AppointmentSheet {
  readonly appointmentId = input<string | null>(null);
  readonly closed = output<void>();
  readonly changed = output<void>();

  private readonly scheduling = inject(SchedulingService);
  private readonly professionals = inject(ProfessionalsService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);

  protected readonly appointmentStatuses = APPOINTMENT_STATUS;
  protected readonly appointmentTones = appointmentTone;
  protected readonly modalities = MODALITY;
  protected readonly channels = CHANNEL_ORIGIN;
  protected readonly origins = STATUS_CHANGE_ORIGIN;

  protected readonly open = computed(() => this.appointmentId() !== null);

  protected readonly detail = this.scheduling.appointmentResource(this.appointmentId);
  protected readonly history = this.scheduling.historyResource(this.appointmentId);
  private readonly staff = this.professionals.professionalsResource();
  private readonly branchStatus = signal<string | null>(null);
  private readonly branches = this.tenancy.branchesResource(this.branchStatus);
  private readonly onlyActiveOfferings = signal<boolean | null>(null);
  private readonly offerings = this.tenancy.offeringsResource(this.onlyActiveOfferings);

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  /** Acción a la espera de motivo; nula mientras no haya nada que explicar. */
  protected readonly confirming = signal<StatusAction | null>(null);
  protected readonly reason = signal('');
  protected readonly rescheduling = signal(false);
  protected readonly newDate = signal('');
  protected readonly newTime = signal('09:00');
  protected readonly newDuration = signal(30);
  protected readonly chosenSlot = signal<Slot | null>(null);

  protected readonly appointment = computed(() => this.detail.value() ?? null);

  protected readonly professionalName = computed(() => {
    const id = this.appointment()?.healthProfessionalPublicId;
    return (this.staff.value() ?? []).find((person) => person.id === id)?.fullName ?? null;
  });
  protected readonly branchName = computed(() => {
    const id = this.appointment()?.branchPublicId;
    return this.branches.value()?.content.find((branch) => branch.id === id)?.name ?? null;
  });
  protected readonly offeringName = computed(() => {
    const id = this.appointment()?.serviceOfferingPublicId;
    return this.offerings.value()?.content.find((item) => item.id === id)?.name ?? null;
  });

  protected readonly duration = computed(() => {
    const appointment = this.appointment();
    return appointment === null
      ? null
      : durationLabel(durationMinutes(appointment.startsAt, appointment.endsAt));
  });

  /** Las transiciones vienen del backend; aquí solo se les pone verbo. */
  protected readonly actions = computed(() =>
    (this.appointment()?.allowedTransitions ?? [])
      .filter((status): status is StatusAction => status in ACTIONS)
      .map((status) => ({ status, ...ACTIONS[status] })),
  );

  protected readonly canReschedule = computed(() =>
    (this.appointment()?.allowedTransitions ?? []).includes('RESCHEDULED' as AppointmentStatus),
  );

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  private readonly professionalOrganizationId = computed(() => {
    const id = this.appointment()?.healthProfessionalPublicId ?? null;
    const organizationId = this.scheduling.organizationId();
    const person = (this.staff.value() ?? []).find((item) => item.id === id) ?? null;
    return person !== null && organizationId !== null ? activeLink(person, organizationId) : null;
  });

  protected readonly slots = this.scheduling.slotsResource({
    professionalOrganizationId: this.professionalOrganizationId,
    professionalId: computed(() => this.appointment()?.healthProfessionalPublicId ?? null),
    branchId: computed(() => this.appointment()?.branchPublicId ?? null),
    date: computed(() => (this.rescheduling() ? this.newDate() || null : null)),
  });
  protected readonly freeSlots = computed<readonly Slot[]>(() => this.slots.value()?.slots ?? []);

  constructor() {
    // Abrir otra cita no debe arrastrar el motivo a medio escribir de la anterior.
    effect(() => {
      this.appointmentId();
      this.failure.set(null);
      this.confirming.set(null);
      this.reason.set('');
      this.rescheduling.set(false);
      this.chosenSlot.set(null);
    });

    effect(() => {
      const appointment = this.appointment();
      if (appointment !== null && this.newDate() === '') {
        this.newDate.set(clinicDate(appointment.startsAt));
        this.newTime.set(clinicTime(appointment.startsAt));
        this.newDuration.set(durationMinutes(appointment.startsAt, appointment.endsAt));
      }
    });
  }

  /* ------------------------------------------------------------ acciones -- */

  protected actionLabel(status: StatusAction): string {
    return ACTIONS[status].label;
  }

  protected needsReason(status: StatusAction): boolean {
    return NEEDS_REASON.includes(status);
  }

  protected run(status: StatusAction): void {
    if (this.needsReason(status) && this.confirming() !== status) {
      this.confirming.set(status);
      this.reason.set('');
      return;
    }
    void this.apply(status);
  }

  private async apply(status: StatusAction): Promise<void> {
    const id = this.appointmentId();
    if (id === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.changeStatus(id, status, {
        reason: this.reason().trim() || null,
        origin: 'USER',
      });
      this.toasts.notify(`Cita ${label(APPOINTMENT_STATUS, status).toLowerCase()}`, 'ok');
      this.confirming.set(null);
      this.reason.set('');
      this.detail.reload();
      this.history.reload();
      this.changed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected cancelConfirm(): void {
    this.confirming.set(null);
    this.reason.set('');
  }

  protected startReschedule(): void {
    this.rescheduling.set(true);
    this.failure.set(null);
  }

  protected chooseSlot(slot: Slot): void {
    this.chosenSlot.set(slot);
    this.newTime.set(clinicTime(slot.startsAt));
    this.newDuration.set(durationMinutes(slot.startsAt, slot.endsAt));
  }

  protected isChosen(slot: Slot): boolean {
    return this.chosenSlot()?.startsAt === slot.startsAt;
  }

  protected slotLabel(slot: Slot): string {
    return clinicTime(slot.startsAt);
  }

  protected async confirmReschedule(): Promise<void> {
    const id = this.appointmentId();
    // Sin hora no hay reprogramación posible: el control nativo la garantizaba,
    // el propio permite vaciarla y `new Date()` produciría una fecha inválida
    // que el backend rechazaría con un 400 poco explicativo.
    if (id === null || !this.newDate() || (this.chosenSlot() === null && !this.newTime())) {
      return;
    }
    const startsAt = this.chosenSlot()?.startsAt ?? clinicInstant(this.newDate(), this.newTime());
    const endsAt =
      this.chosenSlot()?.endsAt ??
      new Date(new Date(startsAt).getTime() + this.newDuration() * 60_000).toISOString();

    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.reschedule(id, {
        startsAt,
        endsAt,
        reason: this.reason().trim() || null,
      });
      this.toasts.notify(
        `Cita reprogramada al ${clinicDate(startsAt)} a las ${clinicTime(startsAt)}`,
        'ok',
      );
      this.rescheduling.set(false);
      this.changed.emit();
      this.closed.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
