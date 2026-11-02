import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { channel, studentMessengers } from '@testing/notification-fixtures';
import { StudentMessengers } from '../data-access/notifications.models';
import { StudentMessengersPanel } from './student-messengers-panel';
import { screenWidth, testProviders } from '@testing/setup';

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
  const silent = studentMessengers({
    studentId: 's-2',
    displayName: 'Пётр',
    avatar: '/api/public/avatars/petr',
  });

  async function render(students: StudentMessengers[], width = 1200): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StudentMessengersPanel],
      providers: [...testProviders(), screenWidth(width)],
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

  it('shows a failed load with «Повторить», not «no students»', async () => {
    TestBed.configureTestingModule({
      imports: [StudentMessengersPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentMessengersPanel);
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/notifications/students')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain(
      'Не удалось загрузить мессенджеры учеников',
    );

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/teacher/notifications/students').flush([]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Учеников пока нет');
  });

  it('says when there are no students', async () => {
    await render([]);

    expect(readableText(hostElement(fixture))).toContain('Учеников пока нет');
  });

  it('counts the students who get the notifications and lists the others with why', async () => {
    const reached = studentMessengers({
      studentId: 's-3',
      displayName: 'Анна',
      channels: [channel({ linked: true, enabled: true })],
    });
    const muted = studentMessengers({
      studentId: 's-4',
      displayName: 'Олег',
      channels: [channel({ linked: true, enabled: false })],
    });
    await render([connected, silent, reached, muted]);

    const host = hostElement(fixture);
    const text = readableText(host);
    expect(text).toContain('1 из 4 получают уведомления в мессенджере');
    expect(text).toContain('Не подключились');
    expect(text).toContain('Мария Не доставлено: 2');
    expect(text).toContain('Пётр Мессенджер не подключён');
    expect(text).toContain('Олег Уведомления на паузе');
    expect(text).toContain('Подключены');
    expect(host.querySelector('.tb-reach__avatars tb-avatar')?.getAttribute('title')).toBe('Анна');
    expect(host.querySelector('p-progressbar')?.getAttribute('aria-label')).toBe(
      'Подключены 1 из 4',
    );
    expect(host.querySelector('tb-avatar img')?.getAttribute('src')).toBe(
      '/api/public/avatars/petr',
    );
    expect(host.querySelector('a[href="/teacher/students"]')?.textContent).toContain('Кто где');
  });

  it('sends the link to connect to one student', async () => {
    await render([connected, silent]);

    const buttons = Array.from(hostElement(fixture).querySelectorAll('button')).filter((button) =>
      button.textContent.includes('Отправить ссылку'),
    );
    expect(buttons).toHaveLength(2);
    buttons[1]?.click();
    const request = backend.expectOne('/api/teacher/notifications/remind-connect');
    expect(request.request.body).toEqual({ studentIds: ['s-2'] });
    request.flush({ recipients: 1 });
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Ссылка на подключение отправлена в личный кабинет' }),
    );
  });

  it('keeps quiet when the link was not sent; on a phone the button is an icon', async () => {
    await render([silent], 390);

    buttonByText(hostElement(fixture), 'Отправить ссылку: Пётр').click();
    backend
      .expectOne('/api/teacher/notifications/remind-connect')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(messages.add).not.toHaveBeenCalled();
  });
});
