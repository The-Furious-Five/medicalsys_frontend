import { SegmentCriteria } from './marketing.models';

/**
 * El vocabulario de la segmentación, y nada más que él.
 *
 * El servicio mantiene una lista blanca de trece ejes (`SegmentCriteriaField`
 * en Java) y rechaza con `422 CLINICAL_DATA_NOT_ALLOWED` cualquier campo que no
 * esté en ella. Aquí se replica esa lista para construir el formulario, de modo
 * que **la interfaz no ofrezca nada que el backend vaya a rechazar**: un
 * desplegable con «diagnóstico» que siempre falla es peor que no tenerlo.
 *
 * El efecto secundario es el que importa: quien arma una audiencia no puede
 * expresar un criterio clínico porque no hay campo donde escribirlo. La promesa
 * de privacidad no se explica en un texto de ayuda; está en la forma del
 * formulario.
 *
 * Los ejes se agrupan por su origen real en la base del servicio:
 *   · demografía  → `ref_patient`, la réplica sin dato clínico;
 *   · actividad   → `patient_activity`, la proyección comercial.
 * Esas dos tablas son las únicas que la consulta de audiencia toca.
 */

export type CriteriaGroup = 'demografia' | 'actividad';

/** Formulario del criterio: todo texto, porque procede de campos de entrada. */
export interface CriteriaForm {
  minAge: string;
  maxAge: string;
  sex: readonly string[];
  cities: string;
  birthdayMonth: string;
  lastVisitBefore: string;
  lastVisitAfter: string;
  minAppointments: string;
  maxNoShows: string;
  minTotalBilledBob: string;
  lastServiceOfferingId: string;
  controlDueBefore: string;
  excludeCampaignId: string;
}

export const EMPTY_CRITERIA: CriteriaForm = {
  minAge: '',
  maxAge: '',
  sex: [],
  cities: '',
  birthdayMonth: '',
  lastVisitBefore: '',
  lastVisitAfter: '',
  minAppointments: '',
  maxNoShows: '',
  minTotalBilledBob: '',
  lastServiceOfferingId: '',
  controlDueBefore: '',
  excludeCampaignId: '',
};

/** Descripción de un eje, para explicarlo donde se usa y no en un manual aparte. */
export interface CriteriaAxis {
  readonly key: keyof CriteriaForm;
  readonly label: string;
  readonly hint: string;
  readonly group: CriteriaGroup;
}

export const CRITERIA_AXES: readonly CriteriaAxis[] = [
  {
    key: 'minAge',
    label: 'Edad mínima',
    hint: 'Años cumplidos.',
    group: 'demografia',
  },
  { key: 'maxAge', label: 'Edad máxima', hint: 'Años cumplidos.', group: 'demografia' },
  { key: 'sex', label: 'Sexo', hint: 'Deja vacío para no filtrar por sexo.', group: 'demografia' },
  {
    key: 'cities',
    label: 'Ciudades',
    hint: 'Separadas por coma. Deben coincidir con la ficha del paciente.',
    group: 'demografia',
  },
  {
    key: 'birthdayMonth',
    label: 'Mes de cumpleaños',
    hint: 'Para campañas de cumpleaños.',
    group: 'demografia',
  },
  {
    key: 'lastVisitBefore',
    label: 'Última visita antes de',
    hint: 'El eje de reactivación: quien no vuelve desde esa fecha.',
    group: 'actividad',
  },
  {
    key: 'lastVisitAfter',
    label: 'Última visita después de',
    hint: 'Para dirigirse a quien vino hace poco.',
    group: 'actividad',
  },
  {
    key: 'minAppointments',
    label: 'Citas atendidas (mínimo)',
    hint: 'Cuántas veces vino al centro.',
    group: 'actividad',
  },
  {
    key: 'maxNoShows',
    label: 'Inasistencias (máximo)',
    hint: 'Permite dejar fuera a quien falta con frecuencia.',
    group: 'actividad',
  },
  {
    key: 'minTotalBilledBob',
    label: 'Gasto acumulado mínimo',
    hint: 'En bolivianos, sumando todo lo facturado.',
    group: 'actividad',
  },
  {
    key: 'lastServiceOfferingId',
    label: 'Última prestación comprada',
    hint: 'Qué compró la última vez.',
    group: 'actividad',
  },
  {
    key: 'controlDueBefore',
    label: 'Control sugerido antes de',
    hint: 'La fecha del control, nunca su motivo.',
    group: 'actividad',
  },
  {
    key: 'excludeCampaignId',
    label: 'Excluir destinatarios de',
    hint: 'Evita repetir el mensaje a quien ya lo recibió en otra campaña.',
    group: 'actividad',
  },
];

const number = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const text = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Convierte el formulario al criterio que viaja al servicio.
 *
 * Los campos vacíos se omiten en vez de enviarse como `null`: un criterio es la
 * conjunción de lo que se declaró, y mandar nulos obligaría al backend a
 * distinguir «sin filtro» de «filtro nulo».
 */
export function toCriteria(form: CriteriaForm): SegmentCriteria {
  const cities = form.cities
    .split(',')
    .map((city) => city.trim())
    .filter((city) => city !== '');

  const criteria: Record<string, unknown> = {
    minAge: number(form.minAge),
    maxAge: number(form.maxAge),
    sex: form.sex.length > 0 ? [...form.sex] : undefined,
    cities: cities.length > 0 ? cities : undefined,
    birthdayMonth: number(form.birthdayMonth),
    lastVisitBefore: text(form.lastVisitBefore),
    lastVisitAfter: text(form.lastVisitAfter),
    minAppointments: number(form.minAppointments),
    maxNoShows: number(form.maxNoShows),
    minTotalBilledBob: number(form.minTotalBilledBob),
    lastServiceOfferingId: text(form.lastServiceOfferingId),
    controlDueBefore: text(form.controlDueBefore),
    excludeCampaignId: text(form.excludeCampaignId),
  };

  for (const key of Object.keys(criteria)) {
    if (criteria[key] === undefined) {
      delete criteria[key];
    }
  }
  return criteria as SegmentCriteria;
}

/** Rellena el formulario desde un criterio guardado, para poder editarlo. */
export function toForm(criteria: SegmentCriteria | null | undefined): CriteriaForm {
  if (!criteria) {
    return { ...EMPTY_CRITERIA };
  }
  const show = (value: number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);

  return {
    minAge: show(criteria.minAge),
    maxAge: show(criteria.maxAge),
    sex: criteria.sex ? [...criteria.sex] : [],
    cities: criteria.cities?.join(', ') ?? '',
    birthdayMonth: show(criteria.birthdayMonth),
    lastVisitBefore: criteria.lastVisitBefore ?? '',
    lastVisitAfter: criteria.lastVisitAfter ?? '',
    minAppointments: show(criteria.minAppointments),
    maxNoShows: show(criteria.maxNoShows),
    minTotalBilledBob: show(criteria.minTotalBilledBob),
    lastServiceOfferingId: criteria.lastServiceOfferingId ?? '',
    controlDueBefore: criteria.controlDueBefore ?? '',
    excludeCampaignId: criteria.excludeCampaignId ?? '',
  };
}

/** Cuántos ejes tiene declarados el criterio; cero significa «todavía no filtra nada». */
export function activeAxisCount(criteria: SegmentCriteria): number {
  return Object.values(criteria).filter(
    (value) => value !== undefined && value !== null && value !== '',
  ).length;
}

/**
 * Coherencia de los rangos, comprobada antes de llamar al servicio.
 *
 * El backend valida lo mismo y responde 422; adelantarlo aquí evita un viaje de
 * ida y vuelta para un error que se ve a simple vista.
 */
export function validationError(form: CriteriaForm): string | null {
  const minAge = number(form.minAge);
  const maxAge = number(form.maxAge);
  const month = number(form.birthdayMonth);

  if (minAge !== undefined && (minAge < 0 || minAge > 130)) {
    return 'La edad mínima debe estar entre 0 y 130 años.';
  }
  if (maxAge !== undefined && (maxAge < 0 || maxAge > 130)) {
    return 'La edad máxima debe estar entre 0 y 130 años.';
  }
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    return 'La edad mínima no puede ser mayor que la máxima.';
  }
  if (month !== undefined && (month < 1 || month > 12)) {
    return 'El mes de cumpleaños debe estar entre 1 y 12.';
  }
  if (
    form.lastVisitBefore !== '' &&
    form.lastVisitAfter !== '' &&
    form.lastVisitAfter > form.lastVisitBefore
  ) {
    return 'La fecha «después de» no puede ser posterior a la fecha «antes de».';
  }
  return null;
}

/** Descripción legible del criterio, para leerlo de un vistazo en un listado. */
export function describeCriteria(
  criteria: SegmentCriteria,
  sexLabel: (v: string) => string,
): string {
  const parts: string[] = [];

  if (criteria.minAge != null && criteria.maxAge != null) {
    parts.push(`${criteria.minAge} a ${criteria.maxAge} años`);
  } else if (criteria.minAge != null) {
    parts.push(`desde ${criteria.minAge} años`);
  } else if (criteria.maxAge != null) {
    parts.push(`hasta ${criteria.maxAge} años`);
  }
  if (criteria.sex?.length) {
    parts.push(criteria.sex.map(sexLabel).join(' o '));
  }
  if (criteria.cities?.length) {
    parts.push(criteria.cities.join(', '));
  }
  if (criteria.birthdayMonth != null) {
    parts.push(`cumple en el mes ${criteria.birthdayMonth}`);
  }
  if (criteria.lastVisitBefore) {
    parts.push(`sin volver desde ${criteria.lastVisitBefore}`);
  }
  if (criteria.lastVisitAfter) {
    parts.push(`visitó después de ${criteria.lastVisitAfter}`);
  }
  if (criteria.minAppointments != null) {
    parts.push(`${criteria.minAppointments}+ citas`);
  }
  if (criteria.maxNoShows != null) {
    parts.push(`hasta ${criteria.maxNoShows} inasistencias`);
  }
  if (criteria.minTotalBilledBob != null) {
    parts.push(`gasto desde Bs ${criteria.minTotalBilledBob}`);
  }
  if (criteria.lastServiceOfferingId) {
    parts.push('última prestación concreta');
  }
  if (criteria.controlDueBefore) {
    parts.push(`control antes de ${criteria.controlDueBefore}`);
  }
  if (criteria.excludeCampaignId) {
    parts.push('excluye otra campaña');
  }

  return parts.length > 0 ? parts.join(' · ') : 'Sin criterios declarados';
}
