import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { bodyText, buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import { aRoom, yandexStatus } from '@testing/meetings-fixtures';
import { Board } from '@features/boards/parts';
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
    for (const request of backend.match((request) => request.url === '/api/teacher/boards')) {
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

  /** «Подробнее» of a student's card: its details and actions. */
  async function openCard(name: string): Promise<void> {
    buttonByText(host, `Подробнее: ${name}`).click();
    await fixture.whenStable();
  }

  it('shows only the name and the phone of a student until the card is opened', async () => {
    await loadStudents([
      BORIS,
      { ...MARIA, phone: '+7 900 000-00-00', email: 'm@example.com' },
      OLEG,
    ]);

    let rows = rowsText();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Борис');
    expect(rows[0]).not.toContain('Приглашён');
    expect(rows[1]).toContain('Мария');
    expect(rows[1]).toContain('+7 900 000-00-00');
    for (const hidden of ['5 класс', 'maria', 'm@example.com', 'Активен', 'Изменить']) {
      expect(rows[1]).not.toContain(hidden);
    }
    const toggle = requireElement(host, 'button[aria-label="Подробнее: Мария"]', HTMLButtonElement);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await openCard('Борис');
    await openCard('Мария');
    rows = rowsText();
    expect(rows[0]).toContain('Приглашён');
    expect(rows[0]).toContain('Приглашение до 01.10.2026');
    expect(rows[0]).toContain('Приглашение');
    for (const shown of ['5 класс', 'maria', 'm@example.com', 'Активен', 'Сбросить пароль']) {
      expect(rows[1]).toContain(shown);
    }
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await openCard('Мария');
    expect(rowsText()[1]).not.toContain('maria');
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

  it('labels the fields of an open card', async () => {
    await loadStudents([MARIA]);
    await openCard('Мария');

    expect(host.querySelector('.p-datatable.tb-cards')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('div.tb-stack > p-card tbody td[data-label]')).map((cell) =>
        cell.getAttribute('data-label'),
      ),
    ).toEqual(['Ученик', 'Почта', 'Статус', 'Логин', 'Видеовстреча', 'Заметка']);
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
    await openCard('Мария');

    buttonByText(host, 'Изменить: Мария').click();
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
    await openCard('Мария');

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
    await openCard('Мария');

    buttonByText(host, 'Отключить доступ: Мария').click();
    backend
      .expectOne('/api/teacher/students/m/deactivate')
      .flush({ ...MARIA, status: 'DEACTIVATED' });
    await fixture.whenStable();
    expect(rowsText()).toHaveLength(1);
    expect(host.textContent).toContain('Никого не найдено');

    requireElement(host, '#show-deactivated', HTMLInputElement).click();
    await fixture.whenStable();
    expect(rowsText()[0]).toContain('Отключён');
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

  it('keeps the cards short: neither groups nor boards of a student', async () => {
    await loadStudents(
      [MARIA],
      [aGroup({ name: 'ОГЭ', members: [{ id: 'm', displayName: 'Мария', status: 'ACTIVE' }] })],
      [],
      [aBoard({ members: [{ type: 'STUDENT', id: 'm', name: 'Мария' }] })],
    );

    await openCard('Мария');
    expect(rowsText()[0]).not.toContain('ОГЭ');
    expect(rowsText()[0]).not.toContain('Доски');
    expect(host.querySelector('a[href="/teacher/boards?student=m"]')).toBeNull();
  });

  it('shows the e-mail of a student and a dash without it', async () => {
    await loadStudents([MARIA, { ...BORIS, email: 'boris@example.com' }]);
    await openCard('Мария');
    await openCard('Борис');

    const emails = Array.from(
      host.querySelectorAll('div.tb-stack > p-card tbody td[data-label="Почта"]'),
    ).map((cell) => cell.textContent.trim());
    expect(emails).toEqual(['—', 'boris@example.com']);
  });

  it('shows the groups under the students and gives them the students to choose from', async () => {
    await loadStudents([MARIA], [aGroup()]);

    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toContain('Добавить ученика');
    expect(host.textContent).toContain('Создать группу');
    const panel = fixture.debugElement.query(By.directive(GroupsPanel)).injector.get(GroupsPanel);
    expect(panel.students()).toEqual([MARIA]);
  });

  it('shows the video room of a student and edits it', async () => {
    await loadStudents([MARIA, BORIS], [], [aRoom({ ownerId: 'm' })]);
    await openCard('Мария');
    await openCard('Борис');

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
});
