import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { eventPublication, failedDelivery } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { EventPublication, FailedDelivery } from '../data-access/admin.models';
import { EventsPage } from './events-page';

describe('EventsPage', () => {
  let fixture: ComponentFixture<EventsPage>;
  let backend: HttpTestingController;
  let messages: MessageService;

  async function render(events: EventPublication[], deliveries: FailedDelivery[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [EventsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(EventsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/events').flush(events);
    backend.expectOne('/api/admin/notifications/deliveries').flush(deliveries);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function rowButton(): HTMLButtonElement {
    const button = hostElement(fixture).querySelector('td.tb-row-actions button');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Row button not found');
    }
    return button;
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says when everything is processed and delivered', async () => {
    await render([], []);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Всё обработано');
    expect(text).toContain('Все сообщения доставлены');
  });

  it('resubmits events', async () => {
    await render([eventPublication()], []);
    expect(readableText(hostElement(fixture))).toContain('HomeworkSubmitted HomeworkNotifications.on 3');

    rowButton().click();
    const one = backend.expectOne('/api/admin/events/resubmit');
    expect(one.request.body).toEqual({ ids: ['e-1'] });
    one.flush({ resubmitted: 1 });
    backend.expectOne('/api/admin/events').flush([eventPublication()]);

    buttonByText(hostElement(fixture), 'Повторить все').click();
    const all = backend.expectOne('/api/admin/events/resubmit');
    expect(all.request.body).toEqual({ ids: [] });
    all.flush({ resubmitted: 1 });
    backend.expectOne('/api/admin/events').flush([]);

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Событий: 1' }));
  });

  it('sends failed deliveries again', async () => {
    await render([], [failedDelivery(), failedDelivery({ id: 'd-2', error: null })]);
    const text = readableText(hostElement(fixture));
    expect(text).toContain('TELEGRAM s-1 Forbidden: bot was blocked by the user');
    expect(text).toContain('—');

    buttonByText(hostElement(fixture), 'Отправить все повторно').click();
    const retry = backend.expectOne('/api/admin/notifications/deliveries/retry');
    expect(retry.request.body).toEqual({ ids: [] });
    retry.flush({ retried: 2 });
    backend.expectOne('/api/admin/notifications/deliveries').flush([]);

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Сообщений: 2' }));
    fixture.componentInstance.retry(['d-1']);
    backend.expectOne('/api/admin/notifications/deliveries/retry').flush({ retried: 1 });
    backend.expectOne('/api/admin/notifications/deliveries').flush([]);
  });
});
