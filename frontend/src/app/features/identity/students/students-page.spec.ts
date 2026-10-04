import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { bodyText, buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import { aRoom, yandexStatus } from '@testing/meetings-fixtures';
import { Board, BoardsDialog } from '@features/boards/parts';
import { MeetingRoom, RoomDialog } from '@features/meetings/parts';
import { aBoard } from '@testing/boards-fixtures';
import { Student, StudentGroup } from '../data-access/identity.models';
import { GroupsPanel } from '../groups/groups-panel';
import { StudentsPage } from './students-page';
import { testProviders } from '@testing/setup';

function student(overrides: Partial<Student>): Student {
  return {
    id: 'id',
    displayName: 'Имя',
    email: null,
    phone: null,
    note: null,
    status: 'ACTIVE',
    login: null,
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    pendingInvite: null,
    ...overrides,
  };
}

const MARIA = student({
  id: 'm',
  displayName: 'Мария',
  status: 'ACTIVE',
  login: 'maria',
  note: '5 класс',
});
const BORIS = student({
  id: 'b',
  displayName: 'Борис',
  status: 'INVITED',
  pendingInvite: { purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
});
const OLEG = student({ id: 'o', displayName: 'Олег', status: 'DEACTIVATED' });

describe('StudentsPage', () => {
  let fixture: ComponentFixture<StudentsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StudentsPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentsPage);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function loadStudents(
    students: Student[],
    groups: StudentGroup[] = [],
    rooms: MeetingRoom[] = [],
    boards: Board[] = [],
  ): Promise<void> {
    backend.expectOne('/api/teacher/students').flush(students);
    for (const request of backend.match('/api/teacher/groups')) {
      request.flush(groups);
    }
    backend.expectOne('/api/teacher/billing/groups').flush({ currency: 'RUB', prices: [] });
    for (const request of backend.match('/api/teacher/meetings/rooms')) {
      request.flush(rooms);
    }
    for (const request of backend.match('/api/teacher/meetings/yandex')) {
      request.flush(yandexStatus());
    }
    for (const request of backend.match('/api/teacher/boards')) {
      request.flush(boards);
    }
    await fixture.whenStable();
  }

  /** A dialog of the page itself, not of the groups panel under the students. */
  function own<T>(type: Type<T>): T {
    const found = fixture.debugElement.children.find(
      (child) => child.componentInstance instanceof type,
    );
    if (found === undefined) {
      throw new Error(`No ${type.name} on the page`);
    }
    return found.injector.get(type);
  }

  /** Answers every waiting request with an empty result. */
  function flushEverything(): void {
    for (const request of backend.match(() => true)) {
      const url = request.request.url;
      request.flush(
        url.endsWith('/yandex')
          ? yandexStatus()
          : url.endsWith('/billing/groups')
            ? { currency: 'RUB', prices: [] }
            : [],
      );
    }
  }

  function studentRows(): Element[] {
    return Array.from(host.querySelectorAll('div.tb-stack > p-card tbody tr'));
  }

  function rowsText(): string[] {
    return studentRows().map((row) => row.textContent);
  }

  it('lists current students with status and invitation', async () => {
    await loadStudents([BORIS, MARIA, OLEG]);

    const rows = rowsText();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Борис');
    expect(rows[0]).toContain('Приглашён');
    expect(rows[0]).toContain('Приглашение до 01.10.2026');
    expect(rows[1]).toContain('Мария');
    expect(rows[1]).toContain('5 класс');
    expect(rows[1]).toContain('maria');
  });

  it('filters by name and shows deactivated students on demand', async () => {
    await loadStudents([BORIS, MARIA, OLEG]);

    typeInto(requireElement(host, 'input[aria-label="Поиск по имени"]', HTMLInputElement), 'мар');
    await fixture.whenStable();
    expect(rowsText()).toHaveLength(1);

    typeInto(requireElement(host, 'input[aria-label="Поиск по имени"]', HTMLInputElement), '');
    requireElement(host, '#show-deactivated', HTMLInputElement).click();
    await fixture.whenStable();
    expect(rowsText().join()).toContain('Олег');
    expect(rowsText().join()).toContain('Отключён');
  });

  it('labels the cells for the cards on a phone', async () => {
    await loadStudents([MARIA]);

    expect(host.querySelector('.p-datatable.tb-cards')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('div.tb-stack > p-card tbody td[data-label]')).map((cell) =>
        cell.getAttribute('data-label'),
      ),
    ).toEqual(['Имя', 'Контакты', 'Группы', 'Видеовстреча', 'Доски', 'Статус', 'Логин']);
  });

  it('opens the form of a new student from the home page', async () => {
    const fromHome = TestBed.createComponent(StudentsPage);
    fromHome.componentRef.setInput('create', 'student');
    await fromHome.whenStable();
    flushEverything();
    await fromHome.whenStable();

    expect(bodyText()).toContain('Новый ученик');
    fromHome.destroy();
  });

  it('invites the first student', async () => {
    await loadStudents([]);
    expect(host.textContent).toContain('Учеников пока нет');

    // the first action is the FAB of the page, not a second button in the empty state (ADR-0018)
    expect(host.querySelector('tb-empty-state button')).toBeNull();
    requireElement(host, '.tb-page-fab button', HTMLButtonElement).click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Новый ученик');
  });

  it('shows the invitation link after creating a student', async () => {
    await loadStudents([MARIA]);
    buttonByText(host, 'Добавить ученика').click();
    await fixture.whenStable();

    typeInto(requireElement(document.body, '#displayName', HTMLInputElement), 'Анна');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();
    backend.expectOne({ method: 'POST', url: '/api/teacher/students' }).flush({
      student: student({ id: 'a', displayName: 'Анна', status: 'INVITED' }),
      invite: { token: 'new-token', purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
    });
    await fixture.whenStable();

    expect(rowsText()[0]).toContain('Анна');
    expect(bodyText()).toContain('Ссылка для ученика: Анна');
  });

  it('edits a student', async () => {
    await loadStudents([MARIA]);

    buttonByText(host, 'Редактировать: Мария').click();
    await fixture.whenStable();
    typeInto(requireElement(document.body, '#displayName', HTMLInputElement), 'Мария Иванова');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();
    backend
      .expectOne('/api/teacher/students/m')
      .flush({ ...MARIA, displayName: 'Мария Иванова', version: 1 });
    await fixture.whenStable();

    expect(rowsText()[0]).toContain('Мария Иванова');
  });

  it('issues a new link', async () => {
    await loadStudents([MARIA]);

    buttonByText(host, 'Ссылка для сброса пароля: Мария').click();
    backend.expectOne('/api/teacher/students/m/invite').flush({
      token: 'reset-token',
      purpose: 'PASSWORD_RESET',
      expiresAt: '2026-10-02T10:00:00Z',
    });
    await fixture.whenStable();

    expect(rowsText()[0]).toContain('Сброс пароля до 02.10.2026');
    expect(bodyText()).toContain('задаст новый пароль');
  });

  it('deactivates after confirmation and reactivates', async () => {
    await loadStudents([MARIA]);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      options.accept?.();
      return confirmation;
    });

    buttonByText(host, 'Отключить доступ: Мария').click();
    backend
      .expectOne('/api/teacher/students/m/deactivate')
      .flush({ ...MARIA, status: 'DEACTIVATED' });
    await fixture.whenStable();
    expect(rowsText()).toHaveLength(1);
    expect(host.textContent).toContain('Никого не найдено');

    requireElement(host, '#show-deactivated', HTMLInputElement).click();
    await fixture.whenStable();
    buttonByText(host, 'Вернуть доступ: Мария').click();
    backend.expectOne('/api/teacher/students/m/reactivate').flush(MARIA);
    await fixture.whenStable();

    expect(rowsText()[0]).toContain('Активен');
  });

  it('shows a failed load with «Повторить», not «no students»', async () => {
    backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });
    flushEverything();
    await fixture.whenStable();

    expect(host.textContent).toContain('Не удалось загрузить учеников');
    expect(host.textContent).not.toContain('Учеников пока нет');

    buttonByText(host, 'Повторить').click();
    backend.expectOne('/api/teacher/students').flush([]);
    await fixture.whenStable();

    expect(host.textContent).toContain('Учеников пока нет');
  });

  it('shows the current groups of each student', async () => {
    await loadStudents(
      [MARIA],
      [
        aGroup({ name: 'ОГЭ', members: [{ id: 'm', displayName: 'Мария', status: 'ACTIVE' }] }),
        aGroup({
          id: 'g2',
          name: 'Английский',
          members: [{ id: 'm', displayName: 'Мария', status: 'ACTIVE' }],
        }),
        aGroup({
          id: 'g3',
          name: 'Прошлый год',
          archivedAt: '2026-06-01T10:00:00Z',
          members: [{ id: 'm', displayName: 'Мария', status: 'ACTIVE' }],
        }),
      ],
    );

    expect(rowsText()[0]).toContain('ОГЭ, Английский');
    expect(rowsText()[0]).not.toContain('Прошлый год');
  });

  it('shows the groups under the students and gives them the students to choose from', async () => {
    await loadStudents([MARIA], [aGroup()]);

    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toContain('Добавить ученика');
    expect(host.textContent).toContain('Создать группу');
    const panel = fixture.debugElement.query(By.directive(GroupsPanel)).injector.get(GroupsPanel);
    expect(panel.students()).toEqual([MARIA]);

    panel.changed.emit();
    backend.expectOne('/api/teacher/groups').flush([]);
    await fixture.whenStable();
  });

  it('shows the video room of a student and edits it', async () => {
    await loadStudents([MARIA, BORIS], [], [aRoom({ ownerId: 'm' })]);

    expect(rowsText()[0]).toContain('Телемост');
    expect(rowsText()[1]).toContain('Добавить');
    buttonByText(host, 'Видеовстреча: Мария').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Видеовстреча: Мария');

    const dialog = own(RoomDialog);
    dialog.changed.emit(null);
    await fixture.whenStable();
    expect(rowsText()[0]).not.toContain('Телемост');

    buttonByText(host, 'Добавить видеовстречу: Борис').click();
    dialog.changed.emit(aRoom({ ownerId: 'b', telemost: false, joinUrl: 'https://zoom.us/j/1' }));
    await fixture.whenStable();
    expect(rowsText()[1]).toContain('Ссылка');
  });

  it('shows the boards of a student and edits them', async () => {
    await loadStudents([MARIA, BORIS], [], [], [aBoard({ ownerId: 'm' })]);

    expect(rowsText()[0]).toContain('Алгебра');
    buttonByText(host, 'Доски: Мария').click();
    await fixture.whenStable();
    const dialog = own(BoardsDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.owner()).toEqual({ type: 'STUDENT', id: 'm', name: 'Мария' });
    expect(dialog.boards()).toEqual([aBoard({ ownerId: 'm' })]);

    buttonByText(host, 'Добавить доску: Борис').click();
    dialog.saved.emit(aBoard({ id: 'board-2', ownerId: 'b', title: 'Физика' }));
    await fixture.whenStable();
    expect(rowsText()[1]).toContain('Физика');
    dialog.removed.emit(aBoard({ id: 'board-2', ownerId: 'b', title: 'Физика' }));
    await fixture.whenStable();
    expect(rowsText()[1]).not.toContain('Физика');
  });
});
