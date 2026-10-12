import { HttpInterceptorFn } from '@angular/common/http';
import { language } from './language';

/**
 * Tells the server the language of the page (ADR-0036): texts it writes in an answer (the settings catalog,
 * the checks of integrations) come in it. Without the header the browser would send its own languages.
 */
export const languageInterceptor: HttpInterceptorFn = (request, next) =>
  next(
    request.url.startsWith('/api/')
      ? request.clone({ setHeaders: { 'Accept-Language': language() } })
      : request,
  );
