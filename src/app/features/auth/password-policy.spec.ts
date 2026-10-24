import { describe, expect, it } from 'vitest';
import { meetsPolicy, passwordRules } from './password-policy';

const unmet = (password: string, email = 'ana@medicalsys.demo') =>
  passwordRules(password, email)
    .filter((rule) => !rule.met)
    .map((rule) => rule.id);

describe('passwordRules (IAM-02)', () => {
  it('acepta una frase larga con espacios como separadores', () => {
    expect(meetsPolicy('Café con leche 7 veces', 'ana@medicalsys.demo')).toBe(true);
  });

  it('nombra cada regla que falta', () => {
    expect(unmet('corta')).toEqual(['length', 'upper', 'digit', 'special']);
    expect(unmet('SIN MINUSCULAS 9')).toEqual(['lower']);
    expect(unmet('SinEspeciales9X')).toEqual(['special']);
    expect(unmet('Sin numeros aqui!')).toEqual(['digit']);
  });

  it('rechaza más de 64 caracteres', () => {
    expect(unmet(`Larga 9 ${'x'.repeat(60)}`)).toEqual(['length']);
  });

  it('rechaza el propio correo aunque cambien las mayúsculas', () => {
    expect(unmet('Ana@MedicalSys.demo1', 'ana@medicalsys.demo1')).toEqual(['email']);
  });

  it('cuenta las letras con tilde como mayúsculas o minúsculas', () => {
    expect(unmet('ÁRBOL Ñandú 2026!')).toEqual([]);
  });
});
