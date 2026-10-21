import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { boundTextbook, myTask, taskDetails } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { TaskDetails } from '../data-access/homework.models';
import { MyHomeworkPage } from './my-homework-page';
import { MyTaskPage } from './my-task-page';
import { testProviders } from '@testing/setup';
import { aMyBoard } from '@testing/boards-fixtures';

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
  it('lists the tasks by the filters of the connected group, newest first', async () => {
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
      myTask({ taskId: 't-4', title: 'Сданное', status: 'SUBMITTED' }),
    ]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    const group = host.querySelector('.tb-segment-group, [role="group"]');
    expect(readableText(group ?? host)).toContain('Сдать 2');
    expect(readableText(group ?? host)).toContain('На проверке 1');
    expect(readableText(group ?? host)).toContain('Готовые 1');

    // «Сдать» first: the tasks to do, the newest first
    const rows = Array.from(host.querySelectorAll('.tb-list > li')).map((row) => readableText(row));
    expect(host.querySelector('table')).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Новое открытое без срока На доработке');
    expect(rows[1]).toMatch(/^Старое открытое до 10[.]09[.]2026 [0-9][0-9]:[0-9][0-9]/);
    expect(rows[1]).toContain('Просрочено');
    expect(host.querySelectorAll('.tb-list__supporting.tb-negative')).toHaveLength(1);
    expect(host.querySelector('a[href="/cabinet/homework/t-3"]')).not.toBeNull();

    buttonByText(host, 'Готовые').click();
    await fixture.whenStable();
    expect(readableText(host.querySelector('.tb-list') ?? host)).toContain('Принятое');
    expect(readableText(host.querySelector('.tb-list') ?? host)).toContain('Оценка: 5');
    buttonByText(host, 'На проверке').click();
    await fixture.whenStable();
    expect(readableText(host.querySelector('.tb-list') ?? host)).toContain('Сданное');
  });

  it('searches by the title and shows the empty state of a filter', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend
      .expectOne('/api/me/homework')
      .flush([
        myTask({ taskId: 't-2', title: 'Старое открытое' }),
        myTask({ taskId: 't-3', title: 'Новое открытое' }),
      ]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    host.querySelector<HTMLButtonElement>('button[aria-label="Поиск"]')?.click();
    await fixture.whenStable();
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Название задания"]');
    if (search === null) {
      throw new Error('no search');
    }
    search.value = 'старое';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.querySelectorAll('.tb-list > li')).toHaveLength(1);
    search.value = 'логарифмы';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(readableText(host)).toContain('Ничего не найдено');

    host.querySelector<HTMLButtonElement>('button[aria-label="Скрыть поиск"]')?.click();
    await fixture.whenStable();
    buttonByText(host, 'Готовые').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Готовых заданий пока нет');
    buttonByText(host, 'На проверке').click();
    await fixture.whenStable();
    expect(readableText(host)).toContain('Нет работ на проверке');
  });

  it('opens the task beside the list and reads the list again after an answer', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    fixture.componentRef.setInput('taskId', 't-1');
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([myTask({ taskId: 't-1', title: 'Дроби' })]);
    backend.expectOne('/api/me/homework/tasks/t-1').flush(taskDetails({ status: 'ASSIGNED' }));
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-my-task-page')).not.toBeNull();
    expect(host.querySelector('li.tb-list__item--current')).not.toBeNull();

    const answer = host.querySelector<HTMLTextAreaElement>('#answer-text');
    if (answer === null) {
      throw new Error('no answer field');
    }
    answer.value = 'Готово';
    answer.dispatchEvent(new Event('input'));
    buttonByText(host, 'Отправить на проверку').click();
    backend.expectOne('/api/me/homework/tasks/t-1/submissions').flush(taskDetails());
    backend.expectOne('/api/me/homework').flush([myTask({ taskId: 't-1', status: 'SUBMITTED' })]);
    await fixture.whenStable();

    expect(readableText(host.querySelector('.tb-list') ?? host)).toContain('На проверке');
  });

  it('asks to choose a task when none is open', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([myTask()]);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Выберите задание');
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

  it('plays the videos of the assignment with the transcripts the teacher shows', async () => {
    const task = taskDetails();
    const { host } = await render({
      ...task,
      assignment: {
        ...task.assignment,
        videos: [
          {
            url: 'https://youtu.be/dQw4w9WgXcQ',
            provider: 'YOUTUBE' as const,
            videoId: 'dQw4w9WgXcQ',
            startSeconds: null,
            title: 'Present Simple',
            transcript: '[0:05] We play',
            transcriptShown: true,
          },
        ],
      },
    });

    expect(readableText(host)).toContain('Видео Present Simple');
    expect(host.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com');
    expect(readableText(host)).not.toContain('ученик видит расшифровку');
  });

  it('leads to the board the teacher put the task on', async () => {
    const task = taskDetails();
    const { host, backend, fixture } = await render({
      ...task,
      assignment: { ...task.assignment, boardId: 'board-1' },
    });
    backend.expectOne('/api/me/boards').flush([aMyBoard()]);
    await fixture.whenStable();

    expect(host.querySelector('a[href="/cabinet/boards/board-1"]')?.textContent).toContain(
      'Перейти на доску',
    );
  });

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

    const open = vi.spyOn(TestBed.inject(FileOpener), 'open').mockImplementation(() => undefined);
    host.querySelector<HTMLButtonElement>('button[aria-label="Открыть Spotlight 5"]')?.click();
    expect(open).toHaveBeenCalledWith(expect.anything(), true, expect.any(Function));
    expect(open.mock.calls[0]?.[2](new Blob([], { type: 'application/pdf' }))).toBe(
      'Spotlight 5 (с. 12-14).pdf',
    );
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
