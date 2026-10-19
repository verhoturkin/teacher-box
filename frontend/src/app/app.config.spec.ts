import { LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TitleStrategy } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { appConfig } from './app.config';
import { NewMessageDialog, NotificationsSheetContent } from '@features/notifications/parts';
import { NEW_MESSAGE_DIALOG } from '@core/notifications/new-message';
import { NOTIFICATIONS_SHEET_CONTENT } from '@core/notifications/notifications-sheet-state';
import { AuthService } from '@core/auth/auth.service';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';
import { authResponse } from '@testing/auth';

describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
  });

  it('uses the Russian locale', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('ru-RU');
    expect(TestBed.inject(PrimeNG).translation.today).toBe('Сегодня');
  });

  it('uses the application title strategy', () => {
    expect(TestBed.inject(TitleStrategy)).toBeInstanceOf(AppTitleStrategy);
  });

  it('gives the frame the bell’s sheet and the dialog of a new message of the notifications feature', async () => {
    await expect(TestBed.inject(NOTIFICATIONS_SHEET_CONTENT)()).resolves.toBe(
      NotificationsSheetContent,
    );
    await expect(TestBed.inject(NEW_MESSAGE_DIALOG)()).resolves.toBe(NewMessageDialog);
  });

  it('restores the session on start', () => {
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/refresh')
      .flush(authResponse('TEACHER'));

    expect(TestBed.inject(AuthService).role()).toBe('TEACHER');
  });
});
