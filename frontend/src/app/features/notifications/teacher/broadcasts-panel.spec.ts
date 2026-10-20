import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewMessageState } from '@core/notifications/new-message';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { broadcastItem } from '@testing/notification-fixtures';
import { BroadcastItem } from '../data-access/notifications.models';
import { BroadcastsPanel } from './broadcasts-panel';
import { testProviders } from '@testing/setup';

describe('BroadcastsPanel', () => {
  let fixture: ComponentFixture<BroadcastsPanel>;
  let backend: HttpTestingController;

  async function render(history: BroadcastItem[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [BroadcastsPanel],
      providers: testProviders(),
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
    await render([
      broadcastItem(),
      broadcastItem({ id: 'b-2', title: 'Без текста', body: null, recipients: 1 }),
    ]);

    const text = readableText(hostElement(fixture));
    // The date is shown in the browser's time zone.
    const sent = formatDate('2026-09-24T10:00:00Z', 'dd.MM.yyyy HH:mm', 'en-US');
    expect(text).toContain(`Каникулы Занятий не будет до 10 января ${sent} · получателей: 3`);
    expect(text).toContain('Без текста');
  });

  it('opens the frame’s dialog of a new message and refreshes when one is sent', async () => {
    await render([]);
    const state = TestBed.inject(NewMessageState);

    buttonByText(hostElement(fixture), 'Написать ученикам').click();
    expect(state.open()).toBe(true);

    state.markSent();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/notifications/broadcasts').flush([broadcastItem()]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Каникулы');
  });
});
