import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { isPulsoApiUrl, PULSO_API_URL } from './auth.config';
import { SessionStore } from './session-store';

const PUBLIC_AUTH_URLS = [`${PULSO_API_URL}/auth/login`, `${PULSO_API_URL}/auth/register`];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(SessionStore);
  const token = store.token();
  const isPulsoRequest = isPulsoApiUrl(request.url);
  const isPublicAuthRequest = PUBLIC_AUTH_URLS.includes(request.url);
  const authenticatedRequest =
    isPulsoRequest && token && !isPublicAuthRequest
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authenticatedRequest).pipe(
    tap({
      error: (error: unknown) => {
        if (
          isPulsoRequest &&
          error instanceof HttpErrorResponse &&
          error.status === 401 &&
          !isPublicAuthRequest
        ) {
          store.clear();
        }
      },
    }),
  );
};
