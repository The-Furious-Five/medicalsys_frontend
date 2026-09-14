import { Injectable, effect, signal } from '@angular/core';

/** Modos disponibles. El claro es el punto de partida y el que se recupera
 *  cuando no hay una elección guardada. */
export type ThemeMode = 'light' | 'dark';

export const DEFAULT_THEME: ThemeMode = 'light';

const THEME_KEY = 'medicalsys.theme';

/**
 * Apariencia de la aplicación.
 *
 * El modo claro es el predeterminado y no depende de la configuración del
 * sistema operativo: en un centro médico la pantalla se comparte entre turnos y
 * el aspecto debe ser el mismo para todos hasta que alguien decida lo
 * contrario. El atributo `data-theme` viaja ya escrito en `index.html`, así que
 * la primera pintura del navegador es clara aunque el equipo esté en oscuro y
 * antes de que arranque Angular.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /* El almacenamiento puede no estar disponible —modo privado, equipo con las
     cookies restringidas—. Este servicio corre al arrancar la aplicación, así
     que una excepción aquí dejaría la pantalla en blanco. Sin almacenamiento se
     pierde la preferencia entre sesiones, que es un inconveniente; no poder
     entrar, no. */
  private static read(): ThemeMode {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }

  private static remember(mode: ThemeMode): void {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* Sin almacenamiento la elección dura lo que dure la pestaña. */
    }
  }

  readonly mode = signal<ThemeMode>(ThemeService.read());

  constructor() {
    effect(() => {
      const mode = this.mode();
      document.documentElement.setAttribute('data-theme', mode);
      ThemeService.remember(mode);
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
