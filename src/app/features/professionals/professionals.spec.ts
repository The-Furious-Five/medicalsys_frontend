import { describe, expect, it } from 'vitest';
import { can } from '../../core/auth/permissions';
import {
  PROFESSIONAL_LINK_STATUS,
  PROFESSIONAL_TYPE,
  WORK_MODALITY,
} from '../../core/labels/labels';
import { Professional } from './professionals.models';
import { activeLink, primarySpecialtyCode } from './professionals.service';

const CENTRE = 'org-1';

const person: Professional = {
  id: 'p-1',
  fullName: 'Quispe Mamani Ana',
  licenseNumber: 'M-1234',
  professionalType: 'PHYSICIAN',
  status: 'ACTIVE',
  specialties: [
    { code: 'PED', primary: false, graduationYear: 2016 },
    { code: 'CARD', primary: true, graduationYear: 2019 },
  ],
  organizations: [
    { id: 'l-otro', organizationId: 'org-9', branchId: null, modality: 'STAFF', status: 'ACTIVE' },
    { id: 'l-1', organizationId: CENTRE, branchId: null, modality: 'FEE_BASED', status: 'ACTIVE' },
  ],
};

describe('profesionales', () => {
  it('la especialidad principal no depende del orden en que llegue', () => {
    expect(primarySpecialtyCode(person)).toBe('CARD');
  });

  it('el vínculo activo es el de este centro y no el de otro', () => {
    // Confundirlos haría que la agenda pidiera huecos con el identificador de
    // una clínica en la que este centro no puede escribir.
    expect(activeLink(person, CENTRE)).toBe('l-1');
  });

  it('consultar el directorio no basta para dar de alta', () => {
    // Recepción tiene la lectura y no el alta: ms-profesionales responde 403
    // al POST, así que la interfaz no le ofrece el botón.
    const reception = ['professionals.professional.read'];
    expect(can.viewProfessionals(reception)).toBe(true);
    expect(can.manageProfessionals(reception)).toBe(false);
    expect(can.manageProfessionals(['professionals.professional.create'])).toBe(true);
  });

  it('las claves de los diccionarios son los enum reales de ms-profesionales', () => {
    // Leídos de `ms-profesionales/domain/*.java`. El estado del vínculo no
    // tiene INACTIVE, que es lo que se supuso al planificar la pantalla.
    expect(Object.keys(PROFESSIONAL_LINK_STATUS)).toEqual(['ACTIVE', 'SUSPENDED', 'ENDED']);
    expect(Object.keys(WORK_MODALITY)).toEqual([
      'STAFF',
      'EXTERNAL_CONSULTANT',
      'FEE_BASED',
      'PARTNER',
    ]);
    expect(Object.keys(PROFESSIONAL_TYPE)).toEqual([
      'PHYSICIAN',
      'DENTIST',
      'PSYCHOLOGIST',
      'NUTRITIONIST',
      'PHYSIOTHERAPIST',
      'NURSING',
      'BIOCHEMIST',
      'OTHER',
    ]);
  });
});
