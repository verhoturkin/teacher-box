import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import {
  ApplicationConfig,
  ErrorHandler,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { ReportingErrorHandler } from '@core/errors/reporting-error-handler';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorInterceptor } from '@core/http/api-error.interceptor';
import { PRIMENG_RU } from '@core/i18n/primeng-ru';
import { Portal } from '@core/portal/portal';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';
import { TeacherBoxPreset } from '@core/theme/teacher-box-preset';
import { DARK_CLASS, ThemeMode } from '@core/theme/theme-mode';

registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: ReportingErrorHandler },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
    ),
    // Order matters: the error toast sees the final result after the auth retry.
    provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
    provideAppInitializer(() => inject(AuthService).restore()),
    provideAppInitializer(() => inject(Portal).load()),
    provideAppInitializer(() => {
      inject(ThemeMode).apply();
    }),
    providePrimeNG({
      theme: { preset: TeacherBoxPreset, options: { darkModeSelector: `.${DARK_CLASS}` } },
      translation: PRIMENG_RU,
      ripple: true,
    }),
    MessageService,
    { provide: LOCALE_ID, useValue: 'ru' },
    { provide: TitleStrategy, useClass: AppTitleStrategy },
  ],
};
