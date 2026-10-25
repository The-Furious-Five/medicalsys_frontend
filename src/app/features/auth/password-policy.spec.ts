import { describe, expect, it } from 'vitest';
import { meetsPolicy, passwordRules } from './password-policy';

const unmet = (password: string, username = 'ana.perez.r') =>
  passwordRules(password, username)
    .filter((rule) => !rule.met)
    .map((rule) => rule.id);

describe('passwordRules (IAM-02)', () => {
  it('acepta una frase larga con espacios como separadores', () => {
    expect(meetsPolicy('Café con leche 7 veces', 'ana.perez.r')).toBe(true);
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

  it('rechaza una contraseña que contiene el usuario, aunque cambien las mayúsculas', () => {
    expect(unmet('Mi clave Ana.Perez.R 9', 'ana.perez.r')).toEqual(['username']);
  });

  it('cuenta las letras con tilde como mayúsculas o minúsculas', () => {
    expect(unmet('ÁRBOL Ñandú 2026!')).toEqual([]);
  });
});
