import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { todayIso } from '../../core/format/format';
import {
  AVAILABILITY_MODALITY,
  BLOCK_TYPE,
  WEEKDAY,
  label,
  options,
} from '../../core/labels/labels';
import { describeFailure } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { ProfessionalsService, activeLink } from '../professionals/professionals.service';
import { AvailabilityModality, BlockType } from './scheduling.models';
import { SchedulingService } from './scheduling.service';
import { addDays, clinicInstant, durationLabel } from './scheduling.time';
import { NumberField } from '../../shared/number-field';
import { TimeField } from '../../shared/time-field';

/**
 * Disponibilidad y bloqueos.
 *
 * Es la pantalla que hace posible todo lo demás: sin una regla semanal vigente
 * la agenda no tiene huecos que ofrecer y citar se vuelve un acto de fe. Por eso
 * lo primero que se ve es el horario de la semana del profesional elegido, y
 * justo debajo las ausencias que lo interrumpen.
 *
 * Las reglas no se borran, se desactivan: una franja que existió explica las
 * citas que se dieron dentro de ella.
 */
@Component({
  selector: 'medsys-availability-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    DateField,
    Icon,
    Notice,
    ErrorState,
    EmptyState,
    Skeleton,
    ...FORMAT_PIPES,
    NumberField,
    TimeField,
  ],
  templateUrl: './availability-page.html',
})
export class AvailabilityPage {
  private readonly scheduling = inject(SchedulingService);
  private readonly professionals = inject(ProfessionalsService);
  private readonly toasts = inject(ToastService);

  protected readonly weekdayOptions = options(WEEKDAY);
  protected readonly modalityOptions = options(AVAILABILITY_MODALITY);
  protected readonly blockTypeOptions = options(BLOCK_TYPE);
  protected readonly weekdays = WEEKDAY;
  protected readonly modalities = AVAILABILITY_MODALITY;
  protected readonly blockTypes = BLOCK_TYPE;

  protected readonly professionalId = signal<string | null>(null);

  private readonly staff = this.professionals.professionalsResource();
  protected readonly professionalOptions = computed(
    () => this.staff.value()?.map((person) => ({ value: person.id, label: person.fullName })) ?? [],
  );
  protected readonly professional = computed(
    () => (this.staff.value() ?? []).find((person) => person.id === this.professionalId()) ?? null,
  );

  /** Sin vínculo activo con el centro no hay reglas que consultar ni crear. */
  protected readonly professionalOrganizationId = computed(() => {
    const person = this.professional();
    const organizationId = this.scheduling.organizationId();
    return person !== null && organizationId !== null ? activeLink(person, organizationId) : null;
  });

  protected readonly rules = this.scheduling.availabilitiesResource(
    this.professionalOrganizationId,
    true,
  );

  /** Los bloqueos que importan son los que vienen: los pasados ya no estorban. */
  private readonly blockRange = computed(() => ({
    from: clinicInstant(todayIso(), '00:00'),
    to: clinicInstant(addDays(todayIso(), 120), '00:00'),
  }));
  protected readonly blocks = this.scheduling.blocksResource(this.blockRange, this.professionalId);

  /* ------------------------------------------------------ formulario regla */

  protected readonly formOpen = signal(false);
  protected readonly dayOfWeek = signal('1');
  protected readonly startTime = signal('08:00');
  protected readonly endTime = signal('12:00');
  protected readonly slotDuration = signal(30);
  protected readonly capacity = signal(1);
  protected readonly modality = signal<AvailabilityModality>('IN_PERSON');
  protected readonly validFrom = signal(todayIso());
  protected readonly validUntil = signal('');

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  /* --------------------------------------------------- formulario bloqueo */

  protected readonly blockFormOpen = signal(false);
  protected readonly blockType = signal<BlockType>('VACATION');
  protected readonly blockFrom = signal(todayIso());
  protected readonly blockFromTime = signal('08:00');
  protected readonly blockTo = signal(todayIso());
  protected readonly blockToTime = signal('18:00');
  protected readonly blockReason = signal('');

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  /** La semana completa, con sus siete días aunque estén vacíos: un día sin
   *  horario es información, no una fila que sobre. */
  protected readonly rulesByDay = computed(() => {
    const all = this.rules.value() ?? [];
    return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      name: label(WEEKDAY, String(day)),
      rules: all
        .filter((rule) => rule.dayOfWeek === day)
        .sort((first, second) => first.startTime.localeCompare(second.startTime)),
    }));
  });

  protected slotLabel(minutes: number): string {
    return durationLabel(minutes);
  }

  protected time(value: string): string {
    return value.slice(0, 5);
  }

  protected setModality(value: string): void {
    this.modality.set((value || 'IN_PERSON') as AvailabilityModality);
  }

  protected setBlockType(value: string): void {
    this.blockType.set((value || 'OTHER') as BlockType);
  }

  /* ------------------------------------------------------------ acciones -- */

  protected async createRule(): Promise<void> {
    const professionalOrganizationPublicId = this.professionalOrganizationId();
    if (professionalOrganizationPublicId === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.createAvailability({
        professionalOrganizationPublicId,
        dayOfWeek: Number(this.dayOfWeek()),
        startTime: `${this.startTime()}:00`,
        endTime: `${this.endTime()}:00`,
        slotDurationMinutes: this.slotDuration(),
        simultaneousCapacity: this.capacity(),
        modality: this.modality(),
        validFrom: this.validFrom(),
        validUntil: this.validUntil() || null,
      });
      this.toasts.notify('Horario añadido', 'ok');
      this.formOpen.set(false);
      this.rules.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async deactivate(id: number): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.deactivateAvailability(id);
      this.toasts.notify('Horario desactivado', 'ok');
      this.rules.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async createBlock(): Promise<void> {
    const organizationPublicId = this.scheduling.organizationId();
    if (organizationPublicId === null || this.professionalId() === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.createBlock({
        organizationPublicId,
        healthProfessionalPublicId: this.professionalId(),
        type: this.blockType(),
        startsAt: clinicInstant(this.blockFrom(), this.blockFromTime()),
        endsAt: clinicInstant(this.blockTo(), this.blockToTime()),
        reason: this.blockReason().trim() || null,
      });
      this.toasts.notify('Bloqueo registrado', 'ok');
      this.blockFormOpen.set(false);
      this.blockReason.set('');
      this.blocks.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async removeBlock(id: number): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.scheduling.deleteBlock(id);
      this.toasts.notify('Bloqueo eliminado', 'ok');
      this.blocks.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
