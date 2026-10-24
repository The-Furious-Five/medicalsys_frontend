import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';
import { Permission, can } from './permissions';

/** Sin sesión se guarda el destino, para devolver al usuario donde iba. */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);

  return session.isAuthenticated()
    ? true
    : router.createUrlTree(['/acceso'], { queryParams: { destino: state.url } });
};

/** El acceso no se muestra a quien ya entró. */
export const publicOnlyGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);

  return session.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

/**
 * El menú ya oculta lo que los permisos no alcanzan; esto cubre la entrada
 * directa por URL, que es la vía por la que alguien llega a una pantalla prohibida.
 */
export const permissionGuard =
  (permission: Permission): CanActivateFn =>
  () => {
    const session = inject(AuthSession);
    const router = inject(Router);

    return can[permission](session.permissions()) ? true : router.createUrlTree(['/sin-permiso']);
  };
