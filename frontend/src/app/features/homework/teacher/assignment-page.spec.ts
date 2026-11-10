import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToBoardDialog } from '@features/boards/parts';
import { FileSaver } from '@shared/files/file-saver';
import {
  ASSIGNMENTS_URL,
  HOMEWORK_STUDENTS,
  assignmentDetails,
  boundTextbook,
  configureHomework,
} from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import { aBoard } from '@testing/boards-fixtures';
import { AssignMoreDialog } from './assign-more-dialog';
import { AssignmentPage } from './assignment-page';
import { screenWidth, testProviders } from '@testing/setup';

describe('AssignmentPage', () => {
  const NOW = new Date('2026-09-06T12:00:00Z');

  async function render(details = assignmentDetails(), width = 1000) {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(width)) });
    const backend = TestBed.inject(HttpTestingController);
    const saved: string[] = [];
    vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, filename) => {
      saved.push(filename);
    });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    backend.expectOne('/api/teacher/homework/assignments/a-1').flush(details);
    await fixture.whenStable();
    return { backend, saved, fixture, host: hostElement(fixture) };
  }

  /** The tasks of the fixture with some changes: a submitted, an accepted, a returned, an open one. */
  function fourTasks() {
    const [anna, boris] = assignmentDetails().tasks;
    return [
      anna!,
      {
        ...boris!,
        taskId: 't-3',
        studentId: 's-3',
        studentName: 'Вера',
        status: 'ACCEPTED' as const,
        grade: '4',
        submittedAt: '2026-09-04T10:00:00Z',
        reviewedAt: '2026-09-05T10:00:00Z',
        overdue: false,
        answerPreview: 'Хорошо',
        quizScore: null,
        quizMax: null,
      },
      {
        ...boris!,
        taskId: 't-4',
        studentId: 's-4',
        studentName: 'Гена',
        status: 'RETURNED' as const,
        submittedAt: '2026-09-02T10:00:00Z',
        reviewedAt: '2026-09-03T10:00:00Z',
        overdue: false,
      },
      boris!,
    ];
  }

  /** «Выдать ещё» in the header of the students: the dialog loads the students and the groups. */
  async function openAssignMore(
    fixture: Awaited<ReturnType<typeof render>>['fixture'],
    backend: HttpTestingController,
  ): Promise<AssignMoreDialog> {
    buttonByText(hostElement(fixture), 'Выдать ещё').click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/students').flush(HOMEWORK_STUDENTS);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/groups').flush([aGroup()]);
    await fixture.whenStable();
    return fixture.debugElement
      .query(By.directive(AssignMoreDialog))
      .injector.get(AssignMoreDialog);
  }

  /** Opens the header «⋮» and clicks the item with the label. */
  async function menuItem(
    fixture: Awaited<ReturnType<typeof render>>['fixture'],
    label: string,
  ): Promise<void> {
    buttonByText(hostElement(fixture), 'Действия').click();
    await fixture.whenStable();
    const item = [...document.body.querySelectorAll<HTMLElement>('.p-menu .p-menu-item-link')].find(
      (link) => link.textContent.includes(label),
    );
    item?.click();
    await fixture.whenStable();
  }

  describe('the header', () => {
    it('has the recipients and the deadline, «Изменить» outlined and «Проверить N работ» filled', async () => {
      const { host, fixture } = await render();
      const header = readableText(host);

      expect(header).toContain('2 ученика · до 10.09.2026');
      const edit = buttonByText(host, 'Изменить');
      expect(edit.classList.contains('p-button-outlined')).toBe(true);
      const review = buttonByText(host, 'Проверить 1 работу');
      expect(review.classList.contains('p-button-outlined')).toBe(false);
      expect(review.classList.contains('p-button-secondary')).toBe(false);
      fixture.destroy();
    });

    it('opens the editor from «Изменить»', async () => {
      const { host, fixture } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      buttonByText(host, 'Изменить').click();

      expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-1', 'edit']);
      fixture.destroy();
    });

    it('opens the review sheet on the first work to review', async () => {
      const { host, fixture } = await render();
      const started = vi.fn();
      fixture.componentInstance.reviewWork.subscribe(started);

      buttonByText(host, 'Проверить 1 работу').click();

      expect(started).toHaveBeenCalledWith('t-1');
      fixture.destroy();
    });

    it('has no filled button when nothing waits for review', async () => {
      const [, boris] = assignmentDetails().tasks;
      const { host, fixture } = await render(assignmentDetails({ tasks: [boris!] }));

      expect(readableText(host)).not.toContain('Проверить 0');
      expect(host.querySelector('p-button[icon="tb-i tb-i-rate_review"]')).toBeNull();
      fixture.destroy();
    });

    it('says there is no deadline', async () => {
      const { host, fixture } = await render(assignmentDetails({ dueAt: null }));

      expect(readableText(host)).toContain('2 ученика · без срока');
      fixture.destroy();
    });

    it('makes a copy from the header «⋮» and opens its editor', async () => {
      const { fixture, backend } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const changed = vi.fn();
      fixture.componentInstance.changed.subscribe(changed);

      await menuItem(fixture, 'Создать копию');
      backend
        .expectOne({ method: 'POST', url: `${ASSIGNMENTS_URL}/a-1/copy` })
        .flush(assignmentDetails({ id: 'a-2', title: 'Дроби (копия)' }));
      await fixture.whenStable();

      expect(navigate).toHaveBeenCalledWith(['/teacher/homework', 'a-2', 'edit']);
      expect(changed).toHaveBeenCalled();
      fixture.destroy();
    });

    it('deletes the assignment from the «⋮» after a confirmation and goes back to the list', async () => {
      const { fixture, backend } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const confirmation = fixture.debugElement.injector.get(ConfirmationService);
      const confirm = vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
        options.accept?.();
        return confirmation;
      });

      await menuItem(fixture, 'Удалить…');
      expect(confirm.mock.calls[0]?.[0].message).toContain('Задание «Дроби» будет удалено');
      await fixture.whenStable();
      backend
        .expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1' })
        .flush(null);
      await fixture.whenStable();

      expect(navigate).toHaveBeenCalledWith(['/teacher/homework']);
      expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Задание «Дроби» удалено' }),
      );
      fixture.destroy();
    });
  });

  it('shows a failed load with «Повторить» and the way back', async () => {
    const { backend } = configureHomework();
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/homework/assignments/a-1')
      .flush(
        { status: 404, code: 'assignment.not-found' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Не удалось загрузить задание Задание не найдено');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/homework/assignments/a-1').flush(assignmentDetails());
    await fixture.whenStable();

    expect(host.querySelector('.tb-markdown strong')?.textContent).toBe('№1-5');
  });

  describe('the student tiles', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('show the status line, the tag, the preview, the quiz score and the files', async () => {
      const { host, fixture } = await render(assignmentDetails({ tasks: fourTasks() }));
      const tiles = [...host.querySelectorAll('ul[aria-label="Ученики"] > li')].map((tile) =>
        readableText(tile),
      );

      expect(tiles[0]).toMatch(
        /^А Анна Сдано вчера, \d\d:\d\d На проверке Ответ: 12 и 7 Тест 8 из 10 1 файл Проверить$/,
      );
      expect(tiles[1]).toBe('В Вера Принято вчера · оценка 4 Принято Хорошо Открыть');
      expect(tiles[2]).toBe('Г Гена Отправлено на доработку 03.09 На доработке Напомнить Открыть');
      // no «Просрочено» tag: the status line says it
      expect(tiles[3]).toMatch(
        /^Б Борис Просрочено на \d+ д(ень|ня|ней) Выдано Напомнить Открыть$/,
      );
      fixture.destroy();
    });

    it('say «сегодня» and «вчера» for the day of the handing in', async () => {
      const [anna] = assignmentDetails().tasks;
      const { host, fixture } = await render(
        assignmentDetails({
          tasks: [
            { ...anna!, submittedAt: '2026-09-06T09:12:00Z' },
            { ...anna!, taskId: 't-5', studentName: 'Яна', submittedAt: '2026-09-05T09:30:00Z' },
          ],
        }),
      );
      const text = readableText(host);

      expect(text).toMatch(/Сдано сегодня, \d\d:\d\d/);
      expect(text).toMatch(/Сдано вчера, \d\d:\d\d/);
      fixture.destroy();
    });

    it('count the accepted, the returned and the works to review above them', async () => {
      const { host, fixture } = await render(assignmentDetails({ tasks: fourTasks() }));
      const head = readableText(requireElement(host, '.tb-asg__head', HTMLElement));

      expect(head).toContain('Принято 1');
      expect(head).toContain('Проверить 1');
      expect(head).toContain('На доработке 1');
      fixture.destroy();
    });

    it('open the work: «Проверить» for a handed in one, «Открыть» for the others', async () => {
      const { host, fixture } = await render();
      const review = host.querySelector('button[aria-label="Проверить: Анна"]');
      const open = host.querySelector('button[aria-label="Открыть: Борис"]');

      expect(review?.getAttribute('aria-label')).toBe('Проверить: Анна');
      expect(open?.getAttribute('aria-label')).toBe('Открыть: Борис');
      expect(host.querySelector('.tb-asg-tile__preview')?.textContent).toBe('Ответ: 12 и 7');
      fixture.destroy();
    });

    it('remind a student who has not handed in, once at a time', async () => {
      const { host, fixture, backend } = await render();
      expect(host.querySelector('button[aria-label="Напомнить: Анна"]')).toBeNull();

      const button = requireElement(
        host,
        'button[aria-label="Напомнить: Борис"]',
        HTMLButtonElement,
      );
      button.click();
      button.click();
      await fixture.whenStable();
      backend
        .expectOne({
          method: 'POST',
          url: '/api/teacher/homework/assignments/a-1/students/s-2/remind',
        })
        .flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'Напоминание отправлено: Борис' }),
      );
      fixture.destroy();
    });

    it('say the assignment is not given to anybody', async () => {
      const { host, fixture } = await render(assignmentDetails({ tasks: [] }));

      expect(readableText(host)).toContain('Задание ещё никому не выдано');
      fixture.destroy();
    });
  });

  it('gives the assignment to more students in a dialog', async () => {
    const { fixture, backend } = await render();
    const dialog = await openAssignMore(fixture, backend);

    dialog.members.setValue([{ kind: 'STUDENT', id: 's-3' }]);
    await fixture.whenStable();
    buttonByText(requireElement(document.body, '.p-dialog', HTMLElement), 'Выдать').click();
    const request = backend.expectOne('/api/teacher/homework/assignments/a-1/students');
    expect(request.request.body).toEqual({ studentIds: ['s-3'] });
    request.flush(assignmentDetails());
    await fixture.whenStable();

    expect(dialog.visible()).toBe(false);
    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Задание выдано' }),
    );
    fixture.destroy();
  });

  it('closes the dialog when nobody is chosen', async () => {
    const { fixture, backend } = await render();
    const dialog = await openAssignMore(fixture, backend);

    dialog.assign();

    expect(dialog.visible()).toBe(false);
    backend.expectNone('/api/teacher/homework/assignments/a-1/students');
    fixture.destroy();
  });

  it('does not reassign students who already have the assignment', async () => {
    const { fixture, backend } = await render();
    const dialog = await openAssignMore(fixture, backend);
    dialog.members.setValue([
      { kind: 'STUDENT', id: 's-1' },
      { kind: 'STUDENT', id: 's-3' },
    ]);
    await fixture.whenStable();
    dialog.assign();
    const request = backend.expectOne('/api/teacher/homework/assignments/a-1/students');
    expect(request.request.body).toEqual({ studentIds: ['s-3'] });
    request.flush(assignmentDetails());
    fixture.destroy();
  });

  describe('the aside', () => {
    const LONG = 'Сделайте упражнения 4–7 на с. 42. '.repeat(8);

    it('shows the materials and downloads a file', async () => {
      const { host, backend, saved, fixture } = await render();

      expect(host.querySelector('ul[aria-label="Файлы"] .tb-i-picture_as_pdf')).not.toBeNull();
      buttonByText(host, 'условие.pdf').click();
      backend.expectOne('/api/teacher/homework/attachments/f-1').flush(new Blob(['pdf']));
      expect(saved).toEqual(['условие.pdf']);
      fixture.destroy();
    });

    it('has no way to upload or remove a file: the editor does it', async () => {
      const { host, fixture } = await render();

      expect(host.querySelector('input[type="file"]')).toBeNull();
      expect(host.querySelector('button[aria-label="Удалить файл условие.pdf"]')).toBeNull();
      expect(readableText(host)).not.toContain('Привязать учебник');
      fixture.destroy();
    });

    it('folds a long text to three lines until «Показать полностью»', async () => {
      const { host, fixture } = await render(assignmentDetails({ description: LONG }));
      const text = requireElement(host, '.tb-asg__text', HTMLElement);

      expect(text.classList.contains('tb-asg__text--folded')).toBe(true);
      buttonByText(host, 'Показать полностью').click();
      await fixture.whenStable();
      expect(text.classList.contains('tb-asg__text--folded')).toBe(false);
      buttonByText(host, 'Свернуть').click();
      await fixture.whenStable();
      expect(text.classList.contains('tb-asg__text--folded')).toBe(true);
      fixture.destroy();
    });

    it('does not fold a short text', async () => {
      const { host, fixture } = await render();

      expect(host.querySelector('.tb-asg__text--folded')).toBeNull();
      expect(readableText(host)).not.toContain('Показать полностью');
      fixture.destroy();
    });

    it('says the assignment has no text', async () => {
      const { host, fixture } = await render(assignmentDetails({ description: null }));

      expect(readableText(host)).toContain('Текст задания не заполнен');
      fixture.destroy();
    });

    it('shows the videos and whether the student sees a transcript', async () => {
      const { host, fixture } = await render(
        assignmentDetails({
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
        }),
      );

      expect(readableText(host)).toContain('Видео Present Simple');
      expect(readableText(host)).toContain('ученик видит расшифровку');
      expect(host.querySelector('iframe')).not.toBeNull();
      fixture.destroy();
    });

    it('lists a bound textbook with its pages', async () => {
      const { host, fixture } = await render(assignmentDetails({ textbooks: [boundTextbook()] }));

      expect(readableText(host)).toContain('Учебник · Английский · с. 12-14');
      fixture.destroy();
    });
  });

  describe('the boards in the «⋮» menu', () => {
    it('links the board the assignment is on', async () => {
      const { fixture } = await render(assignmentDetails({ boardId: 'board-1' }));

      buttonByText(hostElement(fixture), 'Действия').click();
      await fixture.whenStable();
      const link = document.body.querySelector('.p-menu a[href="/teacher/boards/board-1"]');

      expect(link?.textContent).toContain('Открыть доску');
      fixture.destroy();
    });

    it('puts the assignment with its textbook pages on a board and remembers the board', async () => {
      const assignment = assignmentDetails({
        description: null,
        attachments: [],
        textbooks: [boundTextbook({ pages: '12-13' })],
      });
      const { fixture, host, backend } = await render(assignment);

      await menuItem(fixture, 'На доску');
      backend.expectOne((request) => request.url === '/api/teacher/boards').flush([]);
      await fixture.whenStable();

      // The page's own dialog: the textbook's dialog has another one.
      const board = fixture.debugElement
        .queryAll(By.directive(ToBoardDialog))
        .at(-1)!
        .injector.get(ToBoardDialog);
      expect(board.visible()).toBe(true);
      expect(board.title()).toBe(assignment.title);
      expect(board.students()).toEqual(assignment.tasks.map((task) => task.studentId));
      expect(board.pictures()).toEqual([
        '/api/teacher/textbooks/tb-1/pages/12',
        '/api/teacher/textbooks/tb-1/pages/13',
      ]);

      board.placed.emit({ mode: 'text', board: aBoard(), href: '/teacher/boards/board-1' });
      const placed = backend.expectOne({
        method: 'PUT',
        url: '/api/teacher/homework/assignments/a-1/board',
      });
      expect(placed.request.body).toEqual({ boardId: 'board-1' });
      placed.flush({ ...assignment, boardId: 'board-1' });
      await fixture.whenStable();
      expect(readableText(host)).toContain('2 ученика');
      fixture.destroy();
    });

    it('has nothing to put on a board without a text, pictures or pages', async () => {
      const { fixture } = await render(
        assignmentDetails({ description: null, attachments: [], textbooks: [] }),
      );

      buttonByText(hostElement(fixture), 'Действия').click();
      await fixture.whenStable();
      const item = [...document.body.querySelectorAll('.p-menu .p-menu-item')].find((li) =>
        li.textContent.includes('На доску'),
      );

      expect(item?.getAttribute('data-p-disabled')).toBe('true');
      fixture.destroy();
    });
  });

  describe('on a wide screen (sketch 4)', () => {
    const WIDE = 1400;
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('gives the task the main column: the whole text, the materials, the videos and the test', async () => {
      const long = `${'Очень длинный текст задания. '.repeat(10)}\n\n**Конец**`;
      const { host, fixture, backend } = await render(
        assignmentDetails({
          description: long,
          questions: [
            {
              id: 'q-1',
              type: 'SINGLE_CHOICE',
              text: 'Столица?',
              points: 2,
              explanation: null,
              options: [],
              correct: [],
              accepted: [],
              value: null,
              tolerance: null,
              pairs: [],
            },
          ],
          quizAttempts: 2,
          textbooks: [boundTextbook()],
        }),
        WIDE,
      );
      backend
        .expectOne('/api/teacher/homework/assignments/a-1/quiz/stats')
        .flush({ students: 2, questions: [{ questionId: 'q-1', text: 'Столица?', wrong: 1 }] });
      await fixture.whenStable();
      const task = requireElement(host, '.tb-asg__task', HTMLElement);

      expect(task.querySelector('.tb-markdown strong')?.textContent).toBe('Конец');
      expect(task.querySelector('.tb-asg__text--folded')).toBeNull();
      expect(readableText(task)).not.toContain('Показать полностью');
      // the textbooks and the files are one segmented list
      const group = requireElement(task, '.tb-list-group', HTMLElement);
      expect(group.querySelectorAll('li').length).toBeGreaterThan(1);
      expect(readableText(task)).toContain('Тест · 1 вопрос · 2 балла · 2 попытки');
      // the mistakes by question are under the students
      const students = requireElement(host, '.tb-asg__students', HTMLElement);
      expect(students.querySelector('.tb-asg-stats')).not.toBeNull();
      expect(host.querySelector('.tb-asg-tile')).toBeNull();
      fixture.destroy();
    });

    it('groups the students by status with one action a row; empty groups are hidden', async () => {
      const [anna, boris] = assignmentDetails().tasks;
      const { host, fixture } = await render(
        assignmentDetails({
          tasks: [
            ...fourTasks(),
            { ...boris!, taskId: 't-6', studentId: 's-6', studentName: 'Дина' },
          ],
        }),
        WIDE,
      );
      const students = requireElement(host, '.tb-asg__students', HTMLElement);
      const heads = [...students.querySelectorAll('h3')].map((head) => readableText(head));
      const rows = (group: string) =>
        [...students.querySelectorAll(`section[aria-labelledby="tb-asg-group-${group}"] li`)].map(
          (row) => readableText(row),
        );

      expect(readableText(requireElement(students, 'h2', HTMLElement))).toBe('Ученики · 5');
      expect(heads).toEqual(['Проверить · 1', 'На доработке · 1', 'Ждут сдачи · 2', 'Принято · 1']);
      expect(rows('review')[0]).toMatch(/^А Анна Сдано вчера, \d\d:\d\d · Тест 8 из 10 Проверить$/);
      expect(rows('returned')).toEqual(['Г Гена Отправлено на доработку 03.09 Напомнить']);
      expect(rows('waiting')).toHaveLength(2);
      expect(rows('accepted')).toEqual(['В Вера Принято вчера · оценка 4 Открыть']);

      const opened: string[] = [];
      fixture.componentInstance.reviewWork.subscribe((taskId) => opened.push(taskId));
      requireElement(students, 'button[aria-label="Проверить: Анна"]', HTMLButtonElement).click();
      requireElement(students, 'button[aria-label="Открыть: Гена"]', HTMLButtonElement).click();
      expect(opened).toEqual([anna!.taskId, 't-4']);
      fixture.destroy();

      TestBed.resetTestingModule();
      const only = await render(assignmentDetails({ tasks: [anna!] }), WIDE);
      expect(
        [...only.host.querySelectorAll('.tb-asg__students h3')].map((head) => readableText(head)),
      ).toEqual(['Проверить · 1']);
      only.fixture.destroy();
    });

    it('has «Выдать ещё» as an icon button and says when nobody has the assignment', async () => {
      const { host, fixture, backend } = await render(assignmentDetails({ tasks: [] }), WIDE);
      const students = requireElement(host, '.tb-asg__students', HTMLElement);

      expect(readableText(students)).toContain('Задание ещё никому не выдано');
      const more = requireElement(students, 'button[aria-label="Выдать ещё"]', HTMLButtonElement);
      expect(readableText(more)).toBe('');
      more.click();
      await fixture.whenStable();
      backend.expectOne('/api/teacher/students').flush(HOMEWORK_STUDENTS);
      await fixture.whenStable();
      backend.expectOne('/api/teacher/groups').flush([aGroup()]);
      fixture.destroy();
    });
  });

  describe('on a phone (compact)', () => {
    const QUIZ = {
      students: 4,
      questions: [{ questionId: 'q-1', text: 'Столица **России**?', wrong: 3 }],
    };
    const question = {
      id: 'q-1',
      type: 'SINGLE_CHOICE' as const,
      text: 'Столица?',
      points: 1,
      explanation: null,
      options: [],
      correct: [],
      accepted: [],
      value: null,
      tolerance: null,
      pairs: [],
    };

    it('has the tabs «Ученики · Задание» and a fixed «Проверить N работ»', async () => {
      const { host, fixture } = await render(assignmentDetails(), 390);

      const tabs = [...host.querySelectorAll('.tb-asg__tabs button')].map((tab) =>
        readableText(tab),
      );
      expect(tabs).toEqual(['Ученики 2', 'Задание']);
      expect(host.querySelector('.tb-asg__main')).not.toBeNull();
      expect(host.querySelector('.tb-asg__aside')).toBeNull();
      const bottom = requireElement(host, '.tb-bottom-actions', HTMLElement);
      expect(readableText(bottom)).toBe('Проверить 1 работу');
      expect(host.querySelectorAll('p-button[icon="tb-i tb-i-rate_review"]')).toHaveLength(1);
      fixture.destroy();
    });

    it('switches to the assignment tab', async () => {
      const { host, fixture } = await render(assignmentDetails(), 390);

      buttonByText(host, 'Задание').click();
      await fixture.whenStable();

      expect(host.querySelector('.tb-asg__main')).toBeNull();
      expect(host.querySelector('.tb-markdown strong')?.textContent).toBe('№1-5');
      fixture.destroy();
    });

    it('has the tab «Ошибки» only with a quiz', async () => {
      const { host, backend, fixture } = await render(
        assignmentDetails({ questions: [question] }),
        390,
      );
      backend.expectOne('/api/teacher/homework/assignments/a-1/quiz/stats').flush(QUIZ);
      await fixture.whenStable();

      buttonByText(host, 'Ошибки').click();
      await fixture.whenStable();

      expect(host.querySelector('.tb-asg-stats')).not.toBeNull();
      expect(host.querySelector('.tb-asg__main')).toBeNull();
      fixture.destroy();
    });

    it('has no fixed button when nothing waits for review', async () => {
      const [, boris] = assignmentDetails().tasks;
      const { host, fixture } = await render(assignmentDetails({ tasks: [boris!] }), 390);

      expect(host.querySelector('.tb-bottom-actions')).toBeNull();
      fixture.destroy();
    });
  });
});
