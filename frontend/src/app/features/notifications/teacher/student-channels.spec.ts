import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { channel, studentMessengers } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { StudentMessengers } from '../data-access/notifications.models';
import { StudentChannels } from './student-channels';

describe('StudentChannels', () => {
  let fixture: ComponentFixture<StudentChannels>;
  let backend: HttpTestingController;

  async function render(messengers: StudentMessengers): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentChannels], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentChannels);
    fixture.componentRef.setInput('studentId', 's-1');
    await fixture.whenStable();
    backend.expectOne('/api/teacher/notifications/students/s-1').flush(messengers);
    await fixture.whenStable();
  }

  function rows(): string[] {
    return Array.from(hostElement(fixture).querySelectorAll('li')).map((row) => readableText(row));
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('lists the connected messengers and the failed deliveries', async () => {
    await render(
      studentMessengers({
        channels: [
          channel({ linked: true, enabled: true, linkedAt: '2026-09-01T10:00:00Z' }),
          channel({ channel: 'VK', linked: true, enabled: false }),
        ],
        failedDeliveries: 2,
      }),
    );

    expect(rows()).toEqual([
      `Telegram подключён с ${formatDate('2026-09-01T10:00:00Z', 'dd.MM.yyyy', 'en-US')}`,
      'ВКонтакте подключён уведомления на паузе',
      'Не доставлено: 2 Сообщения за 30 дней, которые мессенджер не принял',
    ]);
  });

  it('reminds a student without a messenger to connect one', async () => {
    await render(studentMessengers());
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    expect(rows()[0]).toContain('Мессенджер не подключён');

    buttonByText(hostElement(fixture), 'Напомнить').click();
    const request = backend.expectOne('/api/teacher/notifications/remind-connect');
    expect(request.request.body).toEqual({ studentIds: ['s-1'] });
    request.flush({ recipients: 1 });
    await fixture.whenStable();

    expect(success).toHaveBeenCalledWith('Напоминание отправлено');
  });

  it('stops waiting when the reminder fails', async () => {
    await render(studentMessengers());

    buttonByText(hostElement(fixture), 'Напомнить').click();
    backend
      .expectOne('/api/teacher/notifications/remind-connect')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(buttonByText(hostElement(fixture), 'Напомнить').disabled).toBe(false);
  });
});
