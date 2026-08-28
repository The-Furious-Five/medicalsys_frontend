import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthSession } from '../auth/auth-session';

export const apiRequestInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const accessToken = inject(AuthSession).accessToken();
  const headers: Record<string, string> = {
    'X-Correlation-Id': crypto.randomUUID(),
  };

  if (accessToken !== null) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return next(request.clone({ setHeaders: headers }));
};
