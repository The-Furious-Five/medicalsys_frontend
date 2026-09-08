import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSession } from '../auth/auth-session';

/**
 * Un 401 del gateway cierra la sesión limpiamente y lleva al acceso guardando
 * la ruta de destino. Sin bucles de reintento: el token ya no sirve y volver a
 * pedir lo mismo solo repetiría el fallo.
 */
export const authErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(AuthSession);
  const router = inject(Router);

  return next(request).pipe(
    catchError((failure: unknown) => {
      const isUnauthorized = failure instanceof HttpErrorResponse && failure.status === 401;
      // El propio login devuelve 401 con credenciales incorrectas: ahí el
      // formulario muestra el error y no hay ninguna sesión que cerrar.
      const isLoginAttempt = request.url.includes('/identity/auth/login');

      if (isUnauthorized && !isLoginAttempt && session.isAuthenticated()) {
        session.clear();
        void router.navigate(['/acceso'], {
          queryParams: { destino: router.url },
        });
      }

      return throwError(() => failure);
    }),
  );
};
