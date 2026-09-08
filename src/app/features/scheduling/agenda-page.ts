import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { formatDate, initials, todayIso } from '../../core/format/format';
import { APPOINTMENT_STATUS, label, options } from '../../core/labels/labels';
import { AppointmentStatus, Tone, appointmentTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { Select } from '../../shared/select';
import { PatientName } from '../patients/patient-name';
import { Professional } from '../professionals/professionals.models';
import { ProfessionalsService, primarySpecialtyCode } from '../professionals/professionals.service';
import { AppointmentSheet } from './appointment-sheet';
import { NewAppointmentSheet, NewAppointmentSeed } from './new-appointment-sheet';
import { MIN_BLOCK_MINUTES, assignLanes, hourWindow } from './agenda-layout';
import { Appointment } from './scheduling.models';
import { SchedulingService } from './scheduling.service';
import {
  clinicDate,
  clinicTime,
  durationMinutes,
  longDayLabel,
  minutesOfDay,
  rangeOf,
  shortDayLabel,
  weekDays,
} from './scheduling.time';

/** Un minuto ocupa un píxel: una consulta de media hora mide 30 px y la altura
 *  del bloque es, literalmente, su duración. */
const PX_PER_MINUTE = 1.1;
/**
 * Ancho minimo de la columna de un profesional.
 *
 * Eran 200 px y no daban: descontados el avatar, el relleno y los separadores
 * quedaban 139 px utiles, de modo que «Arispe Calderon Fernando» y la mitad de
 * la plantilla se cortaban en la cabecera, y el nombre del paciente se cortaba
 * dentro de cada cita. Un nombre boliviano completo -dos nombres y dos
 * apellidos- necesita alrededor de 175 px a 13 px de cuerpo; 248 los cubre y
 * deja sitio a la hora dentro del bloque.
 *
 * El tablero ya se desplaza en horizontal, asi que ensanchar no rompe nada:
 * cambia columnas apretadas e ilegibles por columnas legibles que se recorren.
 */
const COLUMN_MIN_WIDTH = 248;
const GUTTER_WIDTH = 64;
/** Al pinchar un hueco, la hora se redondea al cuarto en el que se pinchó. */
const CLICK_STEP_MINUTES = 15;

interface AgendaEvent {
  readonly appointment: Appointment;
  readonly top: number;
  readonly height: number;
  readonly left: string;
  readonly width: string;
  readonly time: string;
  readonly duration: number;
  readonly tone: Tone;
  readonly statusLabel: string;
  readonly compact: boolean;
}

interface AgendaColumn {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly initials: string;
  /** Nulo en la vista semanal: allí la columna es un día, no una persona. */
  readonly professionalId: string | null;
  readonly date: string;
  readonly events: readonly AgendaEvent[];
}

/**
 * Tablero de la agenda.
 *
 * Es la pantalla en la que se trabaja de pie: lo primero que hay que ver es
 * quién atiende hoy, qué franjas están tomadas y cuáles siguen libres. Por eso
 * el día se dibuja como una rejilla de horas y no como una tabla — en una tabla
 * el hueco libre no existe, y el hueco es justo lo que se busca al citar.
 *
 * El estado de cada cita va en color **y** en texto dentro del bloque: el
 * tablero se mira de lejos, y el color solo no basta para decidir a quién
 * llamar.
 */
@Component({
  selector: 'medsys-agenda-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    Icon,
    ErrorState,
    EmptyState,
    Skeleton,
    PatientName,
    AppointmentSheet,
    NewAppointmentSheet,
  ],
  templateUrl: './agenda-page.html',
})
export class AgendaPage {
  private readonly scheduling = inject(SchedulingService);
  private readonly professionals = inject(ProfessionalsService);

  protected readonly statusOptions = options(APPOINTMENT_STATUS);

  /** La leyenda no incluye «Reprogramada»: esa cita ya no ocupa el tablero,
   *  su sustituta sí. */
  protected readonly legend: readonly { status: AppointmentStatus; tone: Tone; text: string }[] = (
    [
      'REQUESTED',
      'CONFIRMED',
      'WAITING',
      'IN_PROGRESS',
      'ATTENDED',
      'NO_SHOW',
      'CANCELLED',
    ] as const
  ).map((status) => ({
    status,
    tone: appointmentTone[status],
    text: label(APPOINTMENT_STATUS, status),
  }));

  protected readonly view = signal<'day' | 'week'>(
    localStorage.getItem('medicalsys.agenda.view') === 'week' ? 'week' : 'day',
  );
  protected readonly date = signal(todayIso());
  protected readonly status = signal<string | null>(null);
  protected readonly specialty = signal<string | null>(null);
  protected readonly professional = signal<string | null>(null);

  protected readonly detailId = signal<string | null>(null);
  protected readonly seed = signal<NewAppointmentSeed | null>(null);

  protected readonly today = todayIso();

  protected readonly days = computed(() =>
    this.view() === 'day' ? [this.date()] : weekDays(this.date()),
  );
  private readonly range = computed(() => rangeOf(this.days()));

  protected readonly list = this.scheduling.appointmentsResource(this.range, {
    status: this.status,
    professionalId: this.professional,
  });
  protected readonly staff = this.professionals.professionalsResource(this.specialty);
  private readonly specialties = this.professionals.specialtiesResource();

  protected readonly specialtyOptions = computed(
    () => this.specialties.value()?.map((item) => ({ value: item.code, label: item.name })) ?? [],
  );
  protected readonly professionalOptions = computed(() =>
    (this.staff.value() ?? []).map((person) => ({ value: person.id, label: person.fullName })),
  );

  private readonly specialtyNames = computed(() => {
    const dictionary = new Map<string, string>();
    for (const item of this.specialties.value() ?? []) {
      dictionary.set(item.code, item.name);
    }
    return dictionary;
  });

  /** Solo las citas que siguen ocupando la agenda se reparten el ancho; una
   *  cancelada se pinta apagada pero no estorba a la que la sustituyó. */
  private readonly appointments = computed<readonly Appointment[]>(
    () => this.list.value()?.content ?? [],
  );

  private readonly visibleStaff = computed<readonly Professional[]>(() => {
    const chosen = this.professional();
    const people = this.staff.value() ?? [];
    return chosen === null ? people : people.filter((person) => person.id === chosen);
  });

  private readonly window = computed(() =>
    hourWindow(
      this.appointments().map((appointment) => ({
        startMinute: minutesOfDay(appointment.startsAt),
        endMinute: minutesOfDay(appointment.endsAt),
      })),
    ),
  );

  protected readonly hours = computed(() => {
    const { from, to } = this.window();
    return Array.from({ length: to - from + 1 }, (_unused, index) => from + index);
  });
  protected readonly boardHeight = computed(
    () => (this.window().to - this.window().from) * 60 * PX_PER_MINUTE,
  );

  /**
   * Citas cuyo profesional no está en el directorio del centro.
   *
   * Pasa de verdad: ms-agenda solo guarda el identificador y no exige que
   * ms-profesionales lo conozca. Sin esta columna esas citas desaparecerían del
   * tablero —existen en la base, pero nadie las vería— que es el peor fallo
   * posible en una agenda. Se muestran nombradas como lo que son.
   */
  private readonly orphanIds = computed<readonly string[]>(() => {
    if (this.specialty() !== null || this.professional() !== null) {
      return [];
    }
    const known = new Set((this.staff.value() ?? []).map((person) => person.id));
    return [
      ...new Set(
        this.appointments()
          .map((appointment) => appointment.healthProfessionalPublicId)
          .filter((id) => !known.has(id)),
      ),
    ];
  });

  protected readonly columns = computed<readonly AgendaColumn[]>(() => {
    const appointments = this.appointments();
    return this.view() === 'day'
      ? [
          ...this.visibleStaff().map((person) =>
            this.column({
              key: person.id,
              title: person.fullName,
              subtitle: this.specialtyOf(person),
              initials: initials(person.fullName),
              professionalId: person.id,
              date: this.date(),
              items: appointments.filter(
                (appointment) => appointment.healthProfessionalPublicId === person.id,
              ),
            }),
          ),
          ...this.orphanIds().map((id) =>
            this.column({
              key: id,
              title: 'Profesional sin ficha',
              subtitle: `Identificador ${id.slice(0, 8)}`,
              initials: '··',
              professionalId: id,
              date: this.date(),
              items: appointments.filter(
                (appointment) => appointment.healthProfessionalPublicId === id,
              ),
            }),
          ),
        ]
      : this.days().map((day) =>
          this.column({
            key: day,
            title: shortDayLabel(day),
            subtitle: day === this.today ? 'Hoy' : '',
            initials: '',
            professionalId: this.professional(),
            date: day,
            items: appointments.filter((appointment) => clinicDate(appointment.startsAt) === day),
          }),
        );
  });

  /** La rejilla se declara aquí y no en la hoja de estilos porque el número de
   *  columnas es un dato —cuánta gente atiende ese día—, no una decisión de
   *  diseño. Con muchas columnas el tablero se desplaza en horizontal antes que
   *  estrujar los nombres. */
  protected readonly gridColumns = computed(
    () =>
      `${GUTTER_WIDTH}px repeat(${Math.max(1, this.columns().length)}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`,
  );
  protected readonly gridMinWidth = computed(
    () => `${GUTTER_WIDTH + Math.max(1, this.columns().length) * COLUMN_MIN_WIDTH}px`,
  );
  /** Las líneas de hora y media hora son un fondo repetido: dibujarlas como
   *  elementos multiplicaría por catorce los nodos de cada columna. */
  protected readonly hourBandSize = `100% ${60 * PX_PER_MINUTE}px`;

  /** Línea de la hora actual; solo tiene sentido si hoy está a la vista. */
  protected readonly nowOffset = computed(() => {
    if (!this.days().includes(this.today)) {
      return null;
    }
    const minutes = minutesOfDay(new Date());
    const { from, to } = this.window();
    if (minutes < from * 60 || minutes > to * 60) {
      return null;
    }
    return (minutes - from * 60) * PX_PER_MINUTE;
  });

  /** Junto a las flechas manda la precisión: la fecha exacta, en cifras. */
  protected readonly stepperLabel = computed(() =>
    this.view() === 'day'
      ? formatDate(this.date())
      : `${formatDate(this.days()[0])} – ${formatDate(this.days()[6])}`,
  );
  /** En la cabecera manda la orientación: qué día de la semana se está mirando. */
  protected readonly heading = computed(() =>
    this.view() === 'day'
      ? longDayLabel(this.date())
      : `Semana del ${shortDayLabel(this.days()[0])} al ${shortDayLabel(this.days()[6])}`,
  );
  protected readonly total = computed(() => this.appointments().length);

  constructor() {
    effect(() => localStorage.setItem('medicalsys.agenda.view', this.view()));
  }

  /* ------------------------------------------------------- construcción -- */

  private specialtyOf(person: Professional): string {
    const code = primarySpecialtyCode(person);
    if (code === null) {
      return 'Sin especialidad declarada';
    }
    return this.specialtyNames().get(code) ?? code;
  }

  private column(input: {
    key: string;
    title: string;
    subtitle: string;
    initials: string;
    professionalId: string | null;
    date: string;
    items: readonly Appointment[];
  }): AgendaColumn {
    const from = this.window().from * 60;
    const placeables = input.items.map((appointment) => ({
      startMinute: minutesOfDay(appointment.startsAt),
      endMinute: minutesOfDay(appointment.endsAt),
    }));
    const lanes = assignLanes(placeables);

    const events = input.items.map((appointment, index) => {
      const start = placeables[index].startMinute;
      const duration = durationMinutes(appointment.startsAt, appointment.endsAt);
      const height = Math.max(duration, MIN_BLOCK_MINUTES) * PX_PER_MINUTE;
      const { lane, lanes: total } = lanes[index];
      return {
        appointment,
        top: (start - from) * PX_PER_MINUTE,
        height,
        left: `calc(${(lane / total) * 100}% + 2px)`,
        width: `calc(${100 / total}% - 4px)`,
        time: `${clinicTime(appointment.startsAt)}–${clinicTime(appointment.endsAt)}`,
        duration,
        tone: appointmentTone[appointment.status],
        statusLabel: label(APPOINTMENT_STATUS, appointment.status),
        compact: height < 52,
      };
    });

    return { ...input, events };
  }

  /* ------------------------------------------------------------ acciones -- */

  protected setView(view: 'day' | 'week'): void {
    this.view.set(view);
  }

  protected step(direction: -1 | 1): void {
    const days = this.view() === 'day' ? 1 : 7;
    const current = new Date(`${this.date()}T12:00:00`);
    current.setDate(current.getDate() + direction * days);
    this.date.set(clinicDate(current));
  }

  protected goToday(): void {
    this.date.set(this.today);
  }

  protected open(appointmentId: string): void {
    this.detailId.set(appointmentId);
  }

  /** Pinchar un hueco abre el alta con esa persona y esa hora ya puestas: es el
   *  gesto natural en un tablero, y ahorra rellenar lo que ya se señaló. */
  protected onEmptySlot(event: MouseEvent, column: AgendaColumn): void {
    const target = event.currentTarget as HTMLElement;
    const offset = event.clientY - target.getBoundingClientRect().top;
    const minute =
      this.window().from * 60 +
      Math.floor(offset / PX_PER_MINUTE / CLICK_STEP_MINUTES) * CLICK_STEP_MINUTES;
    const hours = String(Math.floor(minute / 60)).padStart(2, '0');
    const minutes = String(minute % 60).padStart(2, '0');
    this.seed.set({
      professionalId: column.professionalId,
      date: column.date,
      time: `${hours}:${minutes}`,
    });
  }

  protected newAppointment(): void {
    this.seed.set({
      professionalId: this.professional(),
      date: this.view() === 'day' ? this.date() : this.today,
      time: null,
    });
  }

  protected onSaved(): void {
    this.seed.set(null);
    this.list.reload();
  }

  protected onChanged(): void {
    this.list.reload();
  }

  protected hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  protected hourTop(hour: number): number {
    return (hour - this.window().from) * 60 * PX_PER_MINUTE;
  }
}
