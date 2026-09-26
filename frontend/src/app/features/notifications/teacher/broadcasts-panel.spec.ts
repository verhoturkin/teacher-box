import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { broadcastItem } from '@testing/notification-fixtures';
import { BroadcastItem } from '../data-access/notifications.models';
import { BroadcastsPanel } from './broadcasts-panel';

describe('BroadcastsPanel', () => {
  let fixture: ComponentFixture<BroadcastsPanel>;
  let backend: HttpTestingController;

  async function render(history: BroadcastItem[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [BroadcastsPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BroadcastsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/broadcasts').flush(history);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says when nothing was sent', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Вы ещё не отправляли сообщений');
  });

  it('shows the history of messages', async () => {
    await render([broadcastItem(), broadcastItem({ id: 'b-2', title: 'Без текста', body: null, recipients: 1 })]);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Каникулы 24.09.2026');
    expect(text).toContain('получателей: 3 Занятий не будет до 10 января');
    expect(text).toContain('Без текста');
  });

  it('writes to current students and refreshes the history', async () => {
    await render([]);
    const messages = vi.spyOn(TestBed.inject(MessageService), 'add');

    buttonByText(hostElement(fixture), 'Написать ученикам').click();
    backend.expectOne('/api/teacher/students').flush([
      { id: 's-1', displayName: 'Мария', status: 'ACTIVE' },
      { id: 's-2', displayName: 'Бывший', status: 'DEACTIVATED' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/groups').flush([]);
    expect(bodyText()).toContain('Сообщение ученикам');

    fixture.componentInstance.onBroadcast(1);
    backend.expectOne('/api/teacher/notifications/broadcasts').flush([broadcastItem()]);
    await fixture.whenStable();

    expect(messages).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Получателей: 1' }));
    expect(readableText(hostElement(fixture))).toContain('Каникулы');
  });
});
