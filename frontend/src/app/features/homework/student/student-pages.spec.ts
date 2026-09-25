import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { FileSaver } from '@shared/files/file-saver';
import { myTask, taskDetails } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { TaskDetails } from '../data-access/homework.models';
import { MyHomeworkPage } from './my-homework-page';
import { MyTaskPage } from './my-task-page';

function configure(): { backend: HttpTestingController; saved: string[] } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), providePrimeNG(), MessageService],
  });
  const saved: string[] = [];
  vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, filename) => {
    saved.push(filename);
  });
  vi.spyOn(TestBed.inject(MessageService), 'add');
  return { backend: TestBed.inject(HttpTestingController), saved };
}

describe('MyHomeworkPage', () => {
  it('shows tasks that need work first', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([
      myTask({ taskId: 't-1', title: 'Принятое', status: 'ACCEPTED', grade: '5', assignedAt: '2026-09-05T10:00:00Z' }),
      myTask({ taskId: 't-2', title: 'Старое открытое', assignedAt: '2026-09-01T10:00:00Z', overdue: true }),
      myTask({ taskId: 't-3', title: 'Новое открытое', status: 'RETURNED', dueAt: null, assignedAt: '2026-09-03T10:00:00Z' }),
    ]);
    await fixture.whenStable();

    const rows = Array.from(hostElement(fixture).querySelectorAll('tbody tr')).map((row) => readableText(row));
    expect(rows[0]).toContain('Новое открытое без срока На доработке');
    expect(rows[1]).toContain('Старое открытое');
    expect(rows[1]).toContain('Просрочено');
    expect(rows[2]).toContain('Принятое');
    expect(rows[2]).toContain('Оценка: 5');
  });

  it('shows an empty state', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Заданий пока нет');
  });
});

describe('MyTaskPage', () => {
  async function render(details: TaskDetails) {
    const context = configure();
    const fixture = TestBed.createComponent(MyTaskPage);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    context.backend.expectOne('/api/me/homework/tasks/t-1').flush(details);
    await fixture.whenStable();
    return { ...context, fixture, host: hostElement(fixture) };
  }

  it('hands in an answer with files', async () => {
    const { fixture, host, backend } = await render(taskDetails({ status: 'ASSIGNED', submissions: [] }));
    expect(readableText(host)).toContain('Сдать до 10.09.2026');
    expect(readableText(host)).toContain('Ваш ответ');
    expect(host.querySelector('.tb-markdown strong')?.textContent).toBe('№1-5');

    fixture.componentInstance.text.setValue('  Готово ');
    fixture.componentInstance.files.set([new File(['x'], 'фото.jpg')]);
    await fixture.whenStable();
    buttonByText(host, 'Отправить на проверку').click();

    const request = backend.expectOne('/api/me/homework/tasks/t-1/submissions');
    const body: unknown = request.request.body;
    expect(body instanceof FormData ? body.get('text') : null).toBe('Готово');
    expect(body instanceof FormData ? body.getAll('files') : []).toHaveLength(1);
    request.flush(taskDetails());
    await fixture.whenStable();

    expect(fixture.componentInstance.text.value).toBe('');
    expect(fixture.componentInstance.files()).toEqual([]);
    expect(readableText(host)).toContain('Новый ответ');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('requires text or files', async () => {
    const { fixture, host, backend } = await render(taskDetails({ status: 'ASSIGNED', submissions: [] }));

    buttonByText(host, 'Отправить на проверку').click();
    await fixture.whenStable();

    expect(readableText(host)).toContain('Напишите ответ или прикрепите файл');
    backend.expectNone('/api/me/homework/tasks/t-1/submissions');
  });

  it('shows backend errors', async () => {
    const { fixture, host, backend } = await render(taskDetails({ status: 'ASSIGNED', submissions: [] }));
    fixture.componentInstance.files.set([new File(['x'], 'virus.exe')]);

    fixture.componentInstance.submit();
    backend
      .expectOne('/api/me/homework/tasks/t-1/submissions')
      .flush({ status: 422, code: 'file.type-not-allowed' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(readableText(host)).toContain('Такой тип файла загружать нельзя');
  });

  it('shows the teacher feedback on returned tasks', async () => {
    const { host } = await render(taskDetails({ status: 'RETURNED', teacherComment: 'Исправь №3', overdue: true }));

    expect(readableText(host)).toContain('Нужно доработать Исправь №3');
    expect(readableText(host)).toContain('Новый ответ');
  });

  it('hides the form for accepted tasks and downloads files', async () => {
    const { host, backend, saved } = await render(
      taskDetails({ status: 'ACCEPTED', grade: '5', teacherComment: 'Отлично', assignment: { ...taskDetails().assignment, dueAt: null } }),
    );

    expect(readableText(host)).toContain('Работа принята Отлично');
    expect(readableText(host)).toContain('Без срока');
    expect(host.textContent).not.toContain('Отправить на проверку');

    buttonByText(host, 'условие.pdf').click();
    backend.expectOne('/api/me/homework/attachments/f-1').flush(new Blob(['pdf']));
    expect(saved).toEqual(['условие.pdf']);
  });
});
