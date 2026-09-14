import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME, ThemeService } from './theme.service';

/**
 * El modo claro es un requisito del producto, no una preferencia por defecto
 * del navegador: la pantalla se comparte entre turnos y debe verse igual para
 * todos hasta que alguien elija otra cosa.
 */
function create(): ThemeService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const service = TestBed.inject(ThemeService);
  TestBed.inject(ApplicationRef).tick();
  return service;
}

/** El entorno de pruebas no expone `localStorage`; se instala el mínimo que
 *  necesita el servicio para poder ejercitar la persistencia. */
function installStorage(): Storage {
  const data = new Map<string, string>();
  const shim = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true });
  return shim;
}

describe('ThemeService', () => {
  beforeEach(() => {
    installStorage();
    document.documentElement.removeAttribute('data-theme');
  });

  it('arranca en claro cuando no hay elección guardada', () => {
    expect(create().mode()).toBe('light');
    expect(DEFAULT_THEME).toBe('light');
  });

  it('ignora la preferencia del sistema operativo', () => {
    // No hay ninguna lectura de `prefers-color-scheme`: la única fuente es la
    // elección explícita guardada, y su ausencia significa claro.
    localStorage.removeItem('medicalsys.theme');
    expect(create().mode()).toBe('light');
  });

  it('recupera la elección explícita del usuario', () => {
    localStorage.setItem('medicalsys.theme', 'dark');
    expect(create().mode()).toBe('dark');
  });

  it('trata cualquier valor corrupto como claro', () => {
    localStorage.setItem('medicalsys.theme', 'system');
    expect(create().mode()).toBe('light');
  });

  it('estampa el modo en el documento y lo guarda', () => {
    const service = create();
    service.set('dark');
    TestBed.inject(ApplicationRef).tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('medicalsys.theme')).toBe('dark');
  });

  it('arranca aunque el almacenamiento esté bloqueado', () => {
    // Un equipo con las cookies restringidas hace que el acceso lance. Antes
    // eso ocurría al construir el servicio, es decir, al arrancar la aplicación.
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('acceso denegado');
      },
      configurable: true,
    });

    expect(() => create()).not.toThrow();
    expect(create().mode()).toBe('light');
  });
});
