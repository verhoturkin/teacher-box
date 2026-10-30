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
import { screenWidth, testProviders } from '@testing/setup';
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
  it('groups the tasks: returned with the comment, to do by the deadline, handed in', async () => {
    vi.setSystemTime(new Date('2026-09-10T09:00:00Z'));
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([
      myTask({ taskId: 't-1', title: 'Принятое', status: 'ACCEPTED', grade: '5' }),
      myTask({ taskId: 't-2', title: 'Позже', dueAt: '2026-09-14T15:00:00Z' }),
      myTask({ taskId: 't-3', title: 'Сегодня', dueAt: '2026-09-10T15:00:00Z' }),
      myTask({ taskId: 't-4', title: 'Без срока', dueAt: null }),
      myTask({ taskId: 't-5', title: 'Просрочено', dueAt: '2026-09-08T15:00:00Z', overdue: true }),
      myTask({ taskId: 't-6', title: 'Завтра', dueAt: '2026-09-11T15:00:00Z' }),
      myTask({
        taskId: 't-7',
        title: 'Вернули',
        status: 'RETURNED',
        teacherComment: 'Добавь упражнение 3',
      }),
      myTask({ taskId: 't-8', title: 'Сданное', status: 'SUBMITTED' }),
    ]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(Array.from(host.querySelectorAll('h2')).map((h) => readableText(h))).toEqual([
      'Вернули на доработку',
      'Сделать',
      'Сдано',
    ]);
    const lists = Array.from(host.querySelectorAll('.tb-list')).map((list) =>
      Array.from(list.querySelectorAll(':scope > li')).map((row) => readableText(row)),
    );
    expect(lists[0]).toHaveLength(1);
    expect(lists[0]?.[0]).toContain('Вернули Добавь упражнение 3');
    expect(lists[1]?.map((row) => row.split(' ')[0])).toEqual([
      'Просрочено',
      'Сегодня',
      'Завтра',
      'Позже',
      'Без',
    ]);
    expect(lists[1]?.[0]).toContain('просрочено на 2 дня');
    expect(lists[1]?.[1]).toContain('сегодня');
    expect(lists[1]?.[2]).toContain('остался 1 день');
    expect(lists[1]?.[3]).toContain('осталось 4 дня');
    expect(lists[1]?.[4]).toContain('Без срока');
    expect(lists[2]).toHaveLength(2);
    expect(host.querySelector('a[href="/cabinet/homework/t-7"]')).not.toBeNull();
    expect(host.querySelector('.tb-hw__nearest')).toBeNull();
    vi.useRealTimers();
  });

  it('hides the empty groups and the drafts-free list shows only what exists', async () => {
    const { backend } = configure();
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([myTask({ status: 'ACCEPTED', grade: '5' })]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(Array.from(host.querySelectorAll('h2')).map((h) => readableText(h))).toEqual(['Сдано']);
    expect(readableText(host)).toContain('Оценка: 5');
  });

  it('leads a phone with «Ближайшее»: the oldest returned task, else the nearest to do', async () => {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(400)) });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend
      .expectOne('/api/me/homework')
      .flush([
        myTask({ taskId: 't-1', title: 'Позже', dueAt: '2026-09-20T15:00:00Z' }),
        myTask({ taskId: 't-2', title: 'Скорее', dueAt: '2026-09-12T15:00:00Z' }),
      ]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    const card = host.querySelector('.tb-hw__nearest');
    expect(readableText(card ?? host)).toContain('Ближайшее Скорее');
    expect(card?.querySelector('a[href="/cabinet/homework/t-2"]')).not.toBeNull();
  });

  it('puts a returned task first in «Ближайшее»', async () => {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(400)) });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([
      myTask({ taskId: 't-1', title: 'Обычное' }),
      myTask({
        taskId: 't-2',
        title: 'Вернули',
        status: 'RETURNED',
        teacherComment: 'Ещё раз',
        reviewedAt: '2026-09-02T10:00:00Z',
      }),
    ]);
    await fixture.whenStable();

    expect(
      readableText(hostElement(fixture).querySelector('.tb-hw__nearest') ?? document.body),
    ).toContain('Ближайшее Вернули Ещё раз');
  });

  it('has no «Ближайшее» card when nothing is left to do', async () => {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(400)) });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MyHomeworkPage);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework').flush([myTask({ status: 'SUBMITTED' })]);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('.tb-hw__nearest')).toBeNull();
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

    await fixture.componentInstance.submit();
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
