/**
 * Tiempo de la agenda.
 *
 * ms-agenda habla en instantes con desfase (`OffsetDateTime`) y guarda las
 * reglas semanales en hora local del centro. Las dos representaciones se cruzan
 * en cada pantalla del módulo, así que la conversión vive aquí una sola vez.
 *
 * Bolivia no aplica horario de verano: `America/La_Paz` es siempre UTC−04:00.
 * Por eso el desfase puede escribirse como constante en vez de deducirlo por
 * fecha, y una franja de 09:00 significa lo mismo en enero que en julio.
 */

export const CLINIC_ZONE = 'America/La_Paz';
export const CLINIC_OFFSET = '-04:00';

const isoDateFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: CLINIC_ZONE,
});
const clockFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: CLINIC_ZONE,
});
const longDayFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: CLINIC_ZONE,
});
const shortDayFormat = new Intl.DateTimeFormat('es-BO', {
  weekday: 'short',
  day: 'numeric',
  timeZone: CLINIC_ZONE,
});

/** Fecha simple (yyyy-MM-dd) anclada al mediodía: a medianoche UTC retrocedería un día. */
function atNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00${CLINIC_OFFSET}`);
}

/** yyyy-MM-dd de un instante, ya en la zona del centro. */
export function clinicDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return isoDateFormat.format(date);
}

/** HH:mm de un instante, en la zona del centro. */
export function clinicTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return clockFormat.format(date);
}

/** Minutos transcurridos desde la medianoche del centro. Es la coordenada
 *  vertical de cada cita en el tablero. */
export function minutesOfDay(value: string | Date): number {
  const [hours, minutes] = clinicTime(value).split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** Instante ISO a partir de una fecha y una hora locales del centro. */
export function clinicInstant(isoDate: string, time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${isoDate}T${normalized}${CLINIC_OFFSET}`;
}

/** Rango [00:00, 24:00) del día, tal como lo espera la búsqueda de citas. */
export function dayRange(isoDate: string): { readonly from: string; readonly to: string } {
  return { from: clinicInstant(isoDate, '00:00'), to: clinicInstant(addDays(isoDate, 1), '00:00') };
}

export function rangeOf(days: readonly string[]): { readonly from: string; readonly to: string } {
  const first = days[0];
  const last = days[days.length - 1];
  return { from: clinicInstant(first, '00:00'), to: clinicInstant(addDays(last, 1), '00:00') };
}

export function addDays(isoDate: string, amount: number): string {
  const date = atNoon(isoDate);
  date.setDate(date.getDate() + amount);
  return isoDateFormat.format(date);
}

export function addMinutes(instant: string, amount: number): string {
  return new Date(new Date(instant).getTime() + amount * 60_000).toISOString();
}

/** Día de la semana en ISO-8601: 1 lunes … 7 domingo, como lo guarda ms-agenda. */
export function weekdayOf(isoDate: string): number {
  const day = atNoon(isoDate).getDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function startOfWeek(isoDate: string): string {
  return addDays(isoDate, 1 - weekdayOf(isoDate));
}

/** Los siete días de la semana de esa fecha, de lunes a domingo. */
export function weekDays(isoDate: string): readonly string[] {
  const monday = startOfWeek(isoDate);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(monday, offset));
}

/** «Martes, 1 de septiembre de 2026», con mayúscula inicial. */
export function longDayLabel(isoDate: string): string {
  const text = longDayFormat.format(atNoon(isoDate));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Mar 1», para las cabeceras de la vista semanal. */
export function shortDayLabel(isoDate: string): string {
  const text = shortDayFormat.format(atNoon(isoDate)).replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Duración en minutos entre dos instantes. */
export function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(
    0,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000),
  );
}

/** «45 min» · «1 h 30 min». La duración se lee, no se calcula mentalmente. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
