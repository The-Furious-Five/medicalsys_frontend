import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { authErrorInterceptor } from './core/http/auth-error.interceptor';
import { apiRequestInterceptor } from './core/http/api-request.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      // Los parámetros de ruta llegan a los componentes como `input()`, sin
      // tener que inyectar ActivatedRoute en cada pantalla de detalle.
      withComponentInputBinding(),
      // Al cambiar de vista se vuelve arriba; al volver atrás se recupera la
      // posición, para no perder el sitio en una tabla larga.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([apiRequestInterceptor, authErrorInterceptor])),
  ],
};
