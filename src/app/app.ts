import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Raíz de la aplicación. El armazón con barra lateral y cabecera es una ruta
 * más (`AppShell`), de modo que la pantalla de acceso pueda ocupar el alto
 * completo sin la navegación de alguien que todavía no ha entrado.
 */
@Component({
  selector: 'medsys-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
