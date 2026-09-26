import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { channel, studentMessengers } from '@testing/notification-fixtures';
import { StudentMessengers } from '../data-access/notifications.models';
import { StudentMessengersPanel } from './student-messengers-panel';

describe('StudentMessengersPanel', () => {
  let fixture: ComponentFixture<StudentMessengersPanel>;
  let backend: HttpTestingController;
  let messages: MessageService;

  const connected = studentMessengers({
    channels: [
      channel({ linked: true, enabled: true, displayName: '@maria' }),
      channel({ channel: 'VK', linked: true, enabled: false }),
    ],
    failedDeliveries: 2,
  });
  const silent = studentMessengers({ studentId: 's-2', displayName: 'Пётр' });

  async function render(students: StudentMessengers[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StudentMessengersPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(StudentMessengersPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/students').flush(students);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says when there are no students', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Учеников пока нет');
  });

  it('shows who connected what and delivery problems', async () => {
    await render([connected, silent]);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Подключили мессенджер: 1 из 2');
    expect(text).toContain('Мария Telegram ВКонтакте (на паузе) Не доставлено: 2');
    expect(text).toContain('Пётр не подключены');
  });

  it('reminds everybody without a messenger', async () => {
    await render([connected, silent]);

    buttonByText(hostElement(fixture), 'Напомнить всем без мессенджера').click();
    const request = backend.expectOne('/api/teacher/notifications/remind-connect');
    expect(request.request.body).toEqual({ studentIds: [] });
    request.flush({ recipients: 1 });
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Получили учеников: 1' }));
  });

  it('reminds the selected students', async () => {
    await render([connected, silent]);

    fixture.componentInstance.onSelection([connected]);
    fixture.detectChanges();
    expect(buttonByText(hostElement(fixture), 'Напомнить выбранным').disabled).toBe(true);

    fixture.componentInstance.onSelection([silent]);
    fixture.detectChanges();
    buttonByText(hostElement(fixture), 'Напомнить выбранным').click();
    const request = backend.expectOne('/api/teacher/notifications/remind-connect');
    expect(request.request.body).toEqual({ studentIds: ['s-2'] });
    request.flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(messages.add).not.toHaveBeenCalled();
    expect(buttonByText(hostElement(fixture), 'Напомнить выбранным').disabled).toBe(false);
  });
});
