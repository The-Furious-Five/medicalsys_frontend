/** Formato de fecha, hora, moneda y documento. Contexto: Bolivia, español. */

const LOCALE = 'es-BO';
const TIME_ZONE = 'America/La_Paz';

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
});
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});
const moneyFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parse(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  // Una fecha simple (yyyy-MM-dd) se ancla al mediodía: interpretarla a
  // medianoche UTC la desplazaría un día hacia atrás en la zona de la clínica.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value?: string | null): string {
  const date = parse(value);
  return date ? dateFormat.format(date) : '—';
}

export function formatTime(value?: string | null): string {
  const date = parse(value);
  return date ? timeFormat.format(date) : '—';
}

export function formatDateTime(value?: string | null): string {
  const date = parse(value);
  return date ? `${dateFormat.format(date)} · ${timeFormat.format(date)}` : '—';
}

export function formatWeekday(value: Date): string {
  const text = weekdayFormat.format(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «hace 4 minutos». Solo donde la distancia importa más que el instante. */
export function formatRelative(value?: string | null): string {
  const date = parse(value);
  if (date === null) {
    return '—';
  }
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(diffSeconds);
  const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

  if (absolute < 60) return relative.format(Math.round(diffSeconds), 'second');
  if (absolute < 3600) return relative.format(Math.round(diffSeconds / 60), 'minute');
  if (absolute < 86_400) return relative.format(Math.round(diffSeconds / 3600), 'hour');
  if (absolute < 2_592_000) return relative.format(Math.round(diffSeconds / 86_400), 'day');
  return formatDate(value);
}

/** Importes en bolivianos: siempre dos decimales y siempre con la unidad. */
export function formatBob(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numeric) ? `Bs ${moneyFormat.format(numeric)}` : '—';
}

export function formatNumber(value?: number | string | null, decimals = 0): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numeric);
}

/** El complemento es parte del documento, no un adorno: «8452136 LP». */
export function formatDocument(numberValue?: string | null, complement?: string | null): string {
  if (!numberValue) {
    return '—';
  }
  return complement ? `${numberValue} ${complement}` : numberValue;
}

/** Edad en años cumplidos; en meses para menores de dos años. */
export function formatAge(birthDate?: string | null): string {
  const born = parse(birthDate);
  if (born === null) {
    return '—';
  }
  const today = new Date();
  let years = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    years -= 1;
  }
  if (years >= 2) {
    return `${years} años`;
  }
  const months = Math.max(0, years * 12 + monthDiff - (today.getDate() < born.getDate() ? 1 : 0));
  return months === 1 ? '1 mes' : `${months} meses`;
}

export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${formatNumber(value, value < 10 ? 1 : 0)} ${units[index]}`;
}

/** Iniciales del avatar. Nunca más de dos letras. */
export function initials(fullName?: string | null): string {
  if (!fullName) {
    return '··';
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** yyyy-MM-dd de hoy en la zona de la clínica, para valores de formulario. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date());
}
