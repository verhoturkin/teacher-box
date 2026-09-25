import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TitleStrategy } from '@angular/router';
import { PrimeNG } from 'primeng/config';
import { appConfig } from './app.config';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';

describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  it('uses the Russian locale', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('ru');
    expect(TestBed.inject(PrimeNG).translation.today).toBe('Сегодня');
  });

  it('uses the application title strategy', () => {
    expect(TestBed.inject(TitleStrategy)).toBeInstanceOf(AppTitleStrategy);
  });
});
