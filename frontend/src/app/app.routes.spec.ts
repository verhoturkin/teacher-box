import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { AppTitleStrategy } from '@core/routing/app-title-strategy';

describe('app routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        providePrimeNG(),
        MessageService,
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  it('redirects the root to the teacher area', async () => {
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/teacher');
    expect(text()).toContain('Кабинет учителя');
    expect(text()).toContain('Добро пожаловать в Teacher Box');
    expect(TestBed.inject(Title).getTitle()).toBe('Главная — Teacher Box');
  });

  it('renders the student area', async () => {
    await harness.navigateByUrl('/cabinet');

    expect(text()).toContain('Личный кабинет');
    expect(text()).toContain('Добро пожаловать!');
    expect(TestBed.inject(Title).getTitle()).toBe('Личный кабинет — Teacher Box');
  });

  it('shows the not found page for unknown urls', async () => {
    await harness.navigateByUrl('/no/such/page');

    expect(text()).toContain('404');
    expect(TestBed.inject(Title).getTitle()).toBe('Страница не найдена — Teacher Box');
  });
});
