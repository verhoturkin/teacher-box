import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_NAME, AppTitleStrategy } from './app-title-strategy';

@Component({ selector: 'tb-empty', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Empty {}

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'titled', title: 'Оплаты', component: Empty },
          { path: 'untitled', component: Empty },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
  });

  it('appends the application name to the route title', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/titled');

    expect(TestBed.inject(Title).getTitle()).toBe('Оплаты — Teacher Box');
  });

  it('uses the application name for routes without title', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/untitled');

    expect(TestBed.inject(Title).getTitle()).toBe(APP_NAME);
  });
});
