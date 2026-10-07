import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { FileSaver } from '@shared/files/file-saver';
import { boundTextbook, myTask, taskDetails } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { TaskDetails } from '../data-access/homework.models';
import { MyHomeworkPage } from './my-homework-page';
import { MyTaskPage } from './my-task-page';
import { testProviders } from '@testing/setup';

function configure(): { backend: HttpTestingController; saved: string[] } {
  TestBed.configureTestingModule({
    providers: testProviders(),
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
      myTask({
        taskId: 't-1',
        title: 'Принятое',
        status: 'ACCEPTED',
        grade: '5',
        assignedAt: '2026-09-05T10:00:00Z',
      }),
      myTask({
        taskId: 't-2',
        title: 'Старое открытое',
        assignedAt: '2026-09-01T10:00:00Z',
        overdue: true,
      }),
      myTask({
        taskId: 't-3',
        title: 'Новое открытое',
        status: 'RETURNED',
        dueAt: null,
        assignedAt: '2026-09-03T10:00:00Z',
      }),
    ]);
    await fixture.whenStable();

    const rows = Array.from(hostElement(fixture).querySelectorAll('tbody tr')).map((row) =>
      readableText(row),
    );
    expect(rows[0]).toContain('Новое открытое без срока На доработке');
    expect(rows[1]).toContain('Старое открытое');
    expect(rows[1]).toContain('Просрочено');
    expect(rows[2]).toContain('Принятое');
    expect(rows[2]).toContain('Оценка: 5');
  });

  it('shows a failed load with «Повторить», then the empty state', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить задания');
    expect(readableText(hostElement(fixture))).not.toContain('Заданий пока нет');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/me/homework').flush([]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Заданий пока нет');
  });

  it('shows a task that is not found as an error, not an empty page', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyTaskPage);
    fixture.componentRef.setInput('taskId', 'nope');
    await fixture.whenStable();
    backend
      .expectOne('/api/me/homework/tasks/nope')
      .flush({ status: 404, code: 'task.not-found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain(
      'Задание Не удалось загрузить задание Задание не найдено Повторить',
    );
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

  it('downloads the bound pages of a textbook', async () => {
    const details = taskDetails();
    const { host, backend, saved } = await render(
      taskDetails({
        assignment: {
          ...details.assignment,
          textbooks: [
            boundTextbook(),
            boundTextbook({ textbookId: 'tb-2', title: 'Скан', format: 'IMAGE', pages: null }),
          ],
        },
      }),
    );
    expect(readableText(host)).toContain('Учебники');
    expect(readableText(host)).toContain('с. 12-14');

    host.querySelector<HTMLButtonElement>('button[aria-label="Скачать Spotlight 5"]')?.click();
    backend
      .expectOne('/api/me/homework/tasks/t-1/textbooks/tb-1')
      .flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    host.querySelector<HTMLButtonElement>('button[aria-label="Скачать Скан"]')?.click();
    backend
      .expectOne('/api/me/homework/tasks/t-1/textbooks/tb-2')
      .flush(new Blob(['x'], { type: 'image/jpeg' }));
    expect(saved).toEqual(['Spotlight 5 (с. 12-14).pdf', 'Скан.jpg']);
  });

  it('hands in an answer with files', async () => {
    const { fixture, host, backend } = await render(
      taskDetails({ status: 'ASSIGNED', submissions: [] }),
    );
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
    const { fixture, host, backend } = await render(
      taskDetails({ status: 'ASSIGNED', submissions: [] }),
    );

    buttonByText(host, 'Отправить на проверку').click();
    await fixture.whenStable();

    expect(readableText(host)).toContain('Напишите ответ или прикрепите файл');
    backend.expectNone('/api/me/homework/tasks/t-1/submissions');
  });

  it('shows backend errors', async () => {
    const { fixture, host, backend } = await render(
      taskDetails({ status: 'ASSIGNED', submissions: [] }),
    );
    fixture.componentInstance.files.set([new File(['x'], 'virus.exe')]);

    fixture.componentInstance.submit();
    backend
      .expectOne('/api/me/homework/tasks/t-1/submissions')
      .flush(
        { status: 422, code: 'file.type-not-allowed' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(readableText(host)).toContain('Такой тип файла загружать нельзя');
  });

  it('shows the teacher feedback on returned tasks', async () => {
    const { host } = await render(
      taskDetails({ status: 'RETURNED', teacherComment: 'Исправь №3', overdue: true }),
    );

    expect(readableText(host)).toContain('Нужно доработать Исправь №3');
    expect(readableText(host)).toContain('Новый ответ');
  });

  it('hides the form for accepted tasks and downloads files', async () => {
    const { host, backend, saved } = await render(
      taskDetails({
        status: 'ACCEPTED',
        grade: '5',
        teacherComment: 'Отлично',
        assignment: { ...taskDetails().assignment, dueAt: null },
      }),
    );

    expect(readableText(host)).toContain('Работа принята Отлично');
    expect(readableText(host)).toContain('Без срока');
    expect(host.textContent).not.toContain('Отправить на проверку');

    buttonByText(host, 'условие.pdf').click();
    backend.expectOne('/api/me/homework/attachments/f-1').flush(new Blob(['pdf']));
    expect(saved).toEqual(['условие.pdf']);
  });
});
