import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { scheduleSettings } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { TimeZoneCard } from './time-zone-card';

describe('TimeZoneCard', () => {
  let fixture: ComponentFixture<TimeZoneCard>;
  let backend: HttpTestingController;
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const otherZone = browserZone === 'Asia/Tokyo' ? 'Europe/Moscow' : 'Asia/Tokyo';

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [TimeZoneCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TimeZoneCard);
    fixture.detectChanges();
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the time zone of the portal and who changes it', async () => {
    const host = await render();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    await fixture.whenStable();

    const text = readableText(host);
    expect(text).toContain('Часовой пояс');
    expect(text).toContain(`по часовому поясу ${browserZone}`);
    expect(text).toContain('Поменять его может администратор портала.');
    expect(host.querySelector('p-message')).toBeNull();
  });

  it('tells a device in another time zone that the portal keeps its own', async () => {
    const host = await render();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings({ timeZone: otherZone }));
    await fixture.whenStable();

    expect(readableText(host)).toContain(`по часовому поясу ${otherZone}`);
    expect(host.querySelector('p-message')?.textContent).toContain(
      `другой часовой пояс (${browserZone})`,
    );
  });

  it('offers to load the time zone again after a failure', async () => {
    const host = await render();
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(host)).toContain('часовой пояс');
    const retry = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent.includes('Повторить'),
    );
    retry?.click();
    backend.expectOne('/api/me/schedule/settings').flush(scheduleSettings());
    await fixture.whenStable();
    expect(readableText(host)).toContain('Поменять его может администратор портала.');
  });
});
