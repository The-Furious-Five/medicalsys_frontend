import { describe, expect, it } from 'vitest';
import { SEX, label } from '../../core/labels/labels';
import {
  CRITERIA_AXES,
  CriteriaForm,
  EMPTY_CRITERIA,
  describeCriteria,
  toCriteria,
  toForm,
  validationError,
} from './segment-criteria';

const form = (overrides: Partial<CriteriaForm> = {}): CriteriaForm => ({
  ...EMPTY_CRITERIA,
  ...overrides,
});

/**
 * El constructor de criterios es la cara visible de la frontera de privacidad del
 * servicio: los ejes que ofrece son exactamente los que ms-marketing acepta.
 * Estas pruebas fijan esa correspondencia y la conversión de ida y vuelta.
 */
describe('criterio de segmentación', () => {
  it('ofrece los trece ejes de la lista blanca del servicio, y ninguno más', () => {
    // Copiados de `SegmentCriteriaField` (ms-marketing). Si el servicio añade o
    // quita un eje, esta prueba obliga a revisar el formulario.
    expect(CRITERIA_AXES.map((axis) => axis.key)).toEqual([
      'minAge',
      'maxAge',
      'sex',
      'cities',
      'birthdayMonth',
      'lastVisitBefore',
      'lastVisitAfter',
      'minAppointments',
      'maxNoShows',
      'minTotalBilledBob',
      'lastServiceOfferingId',
      'controlDueBefore',
      'excludeCampaignId',
    ]);
  });

  it('no existe ningún eje clínico', () => {
    const clinical = /diagn|cie10|alerg|allerg|trat|patolog|expedien|receta/i;
    const offending = CRITERIA_AXES.filter((axis) => clinical.test(axis.key));

    expect(offending).toEqual([]);
  });

  it('omite los campos vacíos en vez de enviarlos como nulos', () => {
    // Un criterio es la conjunción de lo declarado; mandar nulos obligaría al
    // backend a distinguir «sin filtro» de «filtro nulo».
    expect(toCriteria(form({ minAge: '18' }))).toEqual({ minAge: 18 });
  });

  it('convierte números, listas y ciudades separadas por coma', () => {
    const criteria = toCriteria(
      form({
        minAge: '18',
        maxAge: '65',
        sex: ['F'],
        cities: 'La Paz,  Sucre ',
        minTotalBilledBob: '250.50',
      }),
    );

    expect(criteria).toEqual({
      minAge: 18,
      maxAge: 65,
      sex: ['F'],
      cities: ['La Paz', 'Sucre'],
      minTotalBilledBob: 250.5,
    });
  });

  it('un criterio vacío no declara ningún eje', () => {
    expect(toCriteria(form())).toEqual({});
  });

  it('rellena el formulario desde un criterio guardado sin perder nada', () => {
    const original = form({
      minAge: '30',
      maxAge: '60',
      sex: ['M', 'F'],
      cities: 'La Paz, Sucre',
      lastVisitBefore: '2025-09-06',
      minAppointments: '2',
    });

    expect(toForm(toCriteria(original))).toEqual(original);
  });

  describe('validación de rangos', () => {
    it('acepta un criterio coherente', () => {
      expect(validationError(form({ minAge: '18', maxAge: '65' }))).toBeNull();
    });

    it('rechaza una edad mínima mayor que la máxima', () => {
      expect(validationError(form({ minAge: '70', maxAge: '30' }))).toContain('mínima');
    });

    it('rechaza una edad fuera del rango que admite el servicio', () => {
      expect(validationError(form({ minAge: '200' }))).toContain('0 y 130');
    });

    it('rechaza un mes de cumpleaños imposible', () => {
      expect(validationError(form({ birthdayMonth: '13' }))).toContain('1 y 12');
    });

    it('rechaza una ventana de visitas invertida', () => {
      const invalid = form({ lastVisitBefore: '2025-01-01', lastVisitAfter: '2025-06-01' });

      expect(validationError(invalid)).toContain('posterior');
    });
  });

  describe('descripción legible', () => {
    const sexLabel = (value: string) => label(SEX, value);

    it('resume el criterio para leerlo de un vistazo', () => {
      const text = describeCriteria(
        toCriteria(form({ minAge: '30', maxAge: '60', sex: ['F'], cities: 'La Paz' })),
        sexLabel,
      );

      expect(text).toBe('30 a 60 años · Femenino · La Paz');
    });

    it('dice que no hay criterios en vez de dejar la celda vacía', () => {
      expect(describeCriteria({}, sexLabel)).toBe('Sin criterios declarados');
    });
  });
});
