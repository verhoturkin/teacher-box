import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { calendarFeed } from '@testing/schedule-fixtures';
import { CalendarFeedPanel } from './calendar-feed-panel';

describe('CalendarFeedPanel', () => {
  let fixture: ComponentFixture<CalendarFeedPanel>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarFeedPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(CalendarFeedPanel);
  });

  afterEach(() => {
    backend.verify();
  });

  async function render(feed = calendarFeed()): Promise<HTMLElement> {
    fixture.detectChanges();
    backend.expectOne('/api/me/schedule/feed').flush(feed);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('creates a link and shows it once with instructions', async () => {
    const host = await render();
    expect(readableText(host)).toContain('Занятия могут появляться в календаре на телефоне');

    buttonByText(host, 'Получить ссылку').click();
    backend
      .expectOne({ method: 'POST', url: '/api/me/schedule/feed' })
      .flush(calendarFeed({ enabled: true, createdAt: '2026-10-01T10:00:00Z', path: '/api/public/schedule/abc.ics' }));
    await fixture.whenStable();

    const link = requireElement(host, 'input[aria-label="Ссылка на календарь"]', HTMLInputElement);
    expect(link.value).toBe(`${window.location.origin}/api/public/schedule/abc.ics`);
    expect(requireElement(host, 'a', HTMLAnchorElement).getAttribute('href')).toMatch(/^webcal:\/\//);
    expect(readableText(host)).toContain('Google Календарь');
  });

  it('copies the link', async () => {
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    const host = await render();
    buttonByText(host, 'Получить ссылку').click();
    backend
      .expectOne({ method: 'POST', url: '/api/me/schedule/feed' })
      .flush(calendarFeed({ enabled: true, path: '/api/public/schedule/abc.ics' }));
    await fixture.whenStable();

    buttonByText(host, 'Копировать ссылку').click();

    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/api/public/schedule/abc.ics`);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('shows an existing link without the address and can disable it', async () => {
    const host = await render(calendarFeed({ enabled: true, createdAt: '2026-10-01T10:00:00Z' }));
    expect(readableText(host)).toContain('Ссылка создана 01.10.2026');
    expect(readableText(host)).toContain('Новая ссылка');

    buttonByText(host, 'Отключить').click();
    backend.expectOne({ method: 'DELETE', url: '/api/me/schedule/feed' }).flush(null);
    await fixture.whenStable();

    expect(readableText(host)).toContain('Получить ссылку');
  });

  it('stops waiting when the link cannot be created', async () => {
    const host = await render();
    buttonByText(host, 'Получить ссылку').click();
    backend
      .expectOne({ method: 'POST', url: '/api/me/schedule/feed' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(host)).toContain('Получить ссылку');
  });
});
