import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorInterceptor } from '@core/http/api-error.interceptor';
import { PRIMENG_RU } from '@core/i18n/primeng-ru';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';
import { TeacherBoxPreset } from '@core/theme/teacher-box-preset';

registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: the error toast sees the final result after the auth retry.
    provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
    provideAppInitializer(() => inject(AuthService).restore()),
    providePrimeNG({
      theme: { preset: TeacherBoxPreset, options: { darkModeSelector: 'system' } },
      translation: PRIMENG_RU,
      ripple: true,
    }),
    MessageService,
    { provide: LOCALE_ID, useValue: 'ru' },
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
