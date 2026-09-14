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
import { RouterLink } from '@angular/router';
import { describeFailure } from '../../core/http/api-error';
import { todayIso } from '../../core/format/format';
import { CHANNEL_ORIGIN, MODALITY, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { PatientPicker } from '../patients/patient-picker';
import { TenancyService } from '../tenancy/tenancy.service';
import { activeLink, primarySpecialtyCode } from '../professionals/professionals.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { ChannelOrigin, Modality, Slot } from './scheduling.models';
import { SchedulingService } from './scheduling.service';
import { clinicInstant, clinicTime, durationLabel } from './scheduling.time';

/** Lo que el tablero ya sabe cuando se pincha un hueco: no se vuelve a pedir. */
export interface NewAppointmentSeed {
  readonly professionalId: string | null;
  readonly date: string;
  readonly time: string | null;
}

const DEFAULT_DURATION = 30;

/**
 * Alta de cita.
 *
 * El orden de los campos es el de la conversación real en el mostrador: quién
 * viene, con quién, para qué y cuándo. La hora se elige de entre los huecos que
 * el propio servicio calcula —descontando bloqueos y citas ya tomadas—, porque
 * ofrecer una franja que el backend va a rechazar convierte el 409 en una
 * sorpresa después de haber tecleado todo lo demás.
 *
 * Cuando no hay reglas de disponibilidad no se deja al usuario encallado: se
 * explica qué falta y se permite fijar la hora a mano, que es como se resuelve
 * una urgencia mientras alguien configura la agenda.
 */
@Component({
  selector: 'medsys-new-appointment-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Select, DateField, Notice, Icon, Skeleton, PatientPicker, RouterLink],
  templateUrl: './new-appointment-sheet.html',
})
export class NewAppointmentSheet {
  readonly seed = input<NewAppointmentSeed | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly scheduling = inject(SchedulingService);
  private readonly professionals = inject(ProfessionalsService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);

  protected readonly modalityOptions = options(MODALITY);
  protected readonly channelOptions = options(CHANNEL_ORIGIN);

  protected readonly open = computed(() => this.seed() !== null);

  /* ------------------------------------------------------------ campos -- */

  protected readonly patientId = signal<string | null>(null);
  protected readonly branchId = signal<string | null>(null);
  protected readonly professionalId = signal<string | null>(null);
  protected readonly offeringId = signal<string | null>(null);
  protected readonly date = signal(todayIso());
  protected readonly modality = signal<Modality>('IN_PERSON');
  protected readonly channelOrigin = signal<ChannelOrigin>('RECEPTION');
  protected readonly resourceId = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly price = signal('');
  protected readonly teleconsultationLink = signal('');

  /** Hueco elegido de la lista, o nulo si la hora se fijó a mano. */
  protected readonly slot = signal<Slot | null>(null);
  protected readonly manual = signal(false);
  protected readonly manualTime = signal('09:00');
  protected readonly manualDuration = signal(DEFAULT_DURATION);

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  /* ------------------------------------------------------------ fuentes -- */

  private readonly branchStatus = signal<string | null>('ACTIVE');
  private readonly onlyActiveOfferings = signal<boolean | null>(true);
  private readonly resourceStatus = signal<string | null>('AVAILABLE');

  protected readonly branches = this.tenancy.branchesResource(this.branchStatus);
  protected readonly offerings = this.tenancy.offeringsResource(this.onlyActiveOfferings);
  protected readonly staff = this.professionals.professionalsResource();
  protected readonly resources = this.scheduling.resourcesResource({
    branchId: this.branchId,
    status: this.resourceStatus,
  });

  protected readonly branchOptions = computed(
    () =>
      this.branches.value()?.content.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })) ?? [],
  );
  protected readonly professionalOptions = computed(
    () => this.staff.value()?.map((person) => ({ value: person.id, label: person.fullName })) ?? [],
  );
  protected readonly offeringOptions = computed(
    () =>
      this.offerings.value()?.content.map((offering) => ({
        value: offering.id,
        label: offering.durationMinutes
          ? `${offering.name} · ${durationLabel(offering.durationMinutes)}`
          : offering.name,
      })) ?? [],
  );
  protected readonly resourceOptions = computed(
    () =>
      this.resources.value()?.content.map((resource) => ({
        value: resource.publicId,
        label: `${resource.code} · ${resource.name}`,
      })) ?? [],
  );

  protected readonly professional = computed(
    () => (this.staff.value() ?? []).find((person) => person.id === this.professionalId()) ?? null,
  );
  protected readonly offering = computed(
    () => this.offerings.value()?.content.find((item) => item.id === this.offeringId()) ?? null,
  );

  /** Vínculo del profesional con este centro: sin él ms-agenda no sabe qué
   *  reglas de disponibilidad aplicar y no hay huecos que ofrecer. */
  private readonly professionalOrganizationId = computed(() => {
    const person = this.professional();
    const organizationId = this.scheduling.organizationId();
    return person !== null && organizationId !== null ? activeLink(person, organizationId) : null;
  });

  protected readonly slots = this.scheduling.slotsResource({
    professionalOrganizationId: this.professionalOrganizationId,
    professionalId: this.professionalId,
    branchId: this.branchId,
    date: computed(() => (this.professionalId() === null ? null : this.date())),
  });

  protected readonly freeSlots = computed<readonly Slot[]>(() => this.slots.value()?.slots ?? []);

  /* ------------------------------------------------------------ derivados */

  protected readonly duration = computed(() => {
    const chosen = this.slot();
    if (chosen !== null) {
      return Math.round(
        (new Date(chosen.endsAt).getTime() - new Date(chosen.startsAt).getTime()) / 60_000,
      );
    }
    return this.manualDuration();
  });

  protected readonly startsAt = computed(() => {
    const chosen = this.slot();
    if (chosen !== null) {
      return chosen.startsAt;
    }
    return this.manual() ? clinicInstant(this.date(), this.manualTime()) : null;
  });

  protected readonly endsAt = computed(() => {
    const chosen = this.slot();
    if (chosen !== null) {
      return chosen.endsAt;
    }
    const start = this.startsAt();
    return start === null
      ? null
      : new Date(new Date(start).getTime() + this.manualDuration() * 60_000).toISOString();
  });

  protected readonly whenLabel = computed(() => {
    const start = this.startsAt();
    const end = this.endsAt();
    return start !== null && end !== null
      ? `${clinicTime(start)}–${clinicTime(end)} · ${durationLabel(this.duration())}`
      : null;
  });

  protected readonly canSubmit = computed(
    () =>
      !this.pending() &&
      this.patientId() !== null &&
      this.branchId() !== null &&
      this.professionalId() !== null &&
      this.offeringId() !== null &&
      this.startsAt() !== null &&
      this.endsAt() !== null,
  );

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly missingAvailability = computed(
    () =>
      this.professionalId() !== null &&
      !this.slots.isLoading() &&
      this.slots.error() === null &&
      this.freeSlots().length === 0,
  );

  constructor() {
    // Abrir la hoja es empezar de cero, salvo lo que el tablero ya señaló.
    effect(() => {
      const seed = this.seed();
      if (seed === null) {
        return;
      }
      this.patientId.set(null);
      this.offeringId.set(null);
      this.resourceId.set(null);
      this.reason.set('');
      this.price.set('');
      this.teleconsultationLink.set('');
      this.modality.set('IN_PERSON');
      this.channelOrigin.set('RECEPTION');
      this.slot.set(null);
      this.failure.set(null);
      this.professionalId.set(seed.professionalId);
      this.date.set(seed.date);
      this.manual.set(seed.time !== null);
      this.manualTime.set(seed.time ?? '09:00');
      this.manualDuration.set(DEFAULT_DURATION);
    });

    // Con una sola sucursal no hay nada que elegir: elegirla por el usuario le
    // ahorra un paso y evita un envío incompleto.
    effect(() => {
      const branches = this.branches.value()?.content ?? [];
      if (this.branchId() === null && branches.length > 0) {
        this.branchId.set((branches.find((branch) => branch.headquarters) ?? branches[0]).id);
      }
    });

    // La prestación trae su duración y su precio: son el valor de partida, no
    // una imposición, y siguen siendo editables.
    effect(() => {
      const offering = this.offering();
      if (offering === null) {
        return;
      }
      this.manualDuration.set(offering.durationMinutes ?? DEFAULT_DURATION);
      this.price.set(offering.basePriceBob ?? '');
      if (offering.type === 'TELECONSULTATION') {
        this.modality.set('TELECONSULTATION');
      }
    });

    // Cambiar de profesional, día o sucursal invalida el hueco ya elegido: era
    // de otra agenda.
    effect(() => {
      this.professionalId();
      this.date();
      this.branchId();
      this.slot.set(null);
    });
  }

  /* ------------------------------------------------------------ acciones -- */

  /** Los desplegables devuelven texto; el modelo no: la conversión ocurre una
   *  vez, aquí, y no en cada plantilla. */
  protected setModality(value: string): void {
    this.modality.set(value === 'TELECONSULTATION' ? 'TELECONSULTATION' : 'IN_PERSON');
  }

  protected setChannel(value: string): void {
    this.channelOrigin.set((value || 'RECEPTION') as ChannelOrigin);
  }

  protected chooseSlot(slot: Slot): void {
    this.slot.set(slot);
    this.manual.set(false);
    this.failure.set(null);
  }

  protected slotLabel(slot: Slot): string {
    return clinicTime(slot.startsAt);
  }

  protected isChosen(slot: Slot): boolean {
    return this.slot()?.startsAt === slot.startsAt;
  }

  protected useManual(): void {
    this.slot.set(null);
    this.manual.set(true);
  }

  protected specialtyOf(): string | null {
    const person = this.professional();
    return person === null ? null : primarySpecialtyCode(person);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.create({
        organizationPublicId: this.scheduling.organizationId()!,
        branchPublicId: this.branchId()!,
        patientPublicId: this.patientId()!,
        healthProfessionalPublicId: this.professionalId()!,
        serviceOfferingPublicId: this.offeringId()!,
        startsAt: this.startsAt()!,
        endsAt: this.endsAt()!,
        modality: this.modality(),
        channelOrigin: this.channelOrigin(),
        reasonForVisit: this.reason().trim() || null,
        requiresConsent: this.offering()?.requiresConsent ?? false,
        estimatedPriceBob: this.price().trim() || null,
        teleconsultationLink:
          this.modality() === 'TELECONSULTATION'
            ? this.teleconsultationLink().trim() || null
            : null,
        physicalResourcePublicId: this.resourceId(),
      });
      this.toasts.notify(`Cita agendada para las ${clinicTime(this.startsAt()!)}`, 'ok');
      this.saved.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
