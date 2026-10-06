import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import {
  bodyText,
  buttonByText,
  hostElement,
  menuItemByText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import { Student, StudentGroup } from '../data-access/identity.models';
import { GroupsPanel } from '../groups/groups-panel';
import { StudentsPage } from './students-page';
import { testProviders } from '@testing/setup';

function student(overrides: Partial<Student>): Student {
  return {
    id: 'id',
    displayName: 'Имя',
    avatar: null,
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

  async function loadStudents(students: Student[], groups: StudentGroup[] = []): Promise<void> {
    backend.expectOne('/api/teacher/students').flush(students);
    backend.expectOne('/api/teacher/groups').flush(groups);
    backend.expectOne('/api/teacher/billing/groups').flush({ currency: 'RUB', prices: [] });
    await fixture.whenStable();
  }

  /** Answers every waiting request with an empty result. */
  function flushEverything(): void {
    for (const request of backend.match(() => true)) {
      const url = request.request.url;
      request.flush(url.endsWith('/billing/groups') ? { currency: 'RUB', prices: [] } : []);
    }
  }

  function rowsText(): string[] {
    return Array.from(host.querySelectorAll('ul.tb-list[aria-label="Ученики"] > li')).map(
      (row) => row.textContent,
    );
  }

  /** The «⋮» menu of a student, then one of its items. */
  async function act(name: string, item: string): Promise<void> {
    buttonByText(host, `Действия: ${name}`).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  it('shows the name, the phone and the status of each current student', async () => {
    await loadStudents([
      BORIS,
      { ...MARIA, phone: '+7 900 000-00-00', email: 'm@example.com' },
      OLEG,
    ]);

    const rows = rowsText();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Борис');
    expect(rows[0]).toContain('Приглашён');
    expect(rows[1]).toContain('Мария');
    expect(rows[1]).toContain('+7 900 000-00-00');
    expect(rows[1]).toContain('Активен');
    for (const hidden of ['5 класс', 'maria', 'm@example.com']) {
      expect(rows[1]).not.toContain(hidden);
    }
  });

  it('puts the login and the note in the tooltip of the name', async () => {
    await loadStudents([MARIA, BORIS]);

    const [maria, boris] = fixture.debugElement.queryAll(By.css('.tb-list__title'));
    expect(maria?.injector.get(Tooltip).content).toBe('Логин: maria\nЗаметка: 5 класс');
    expect(maria?.attributes['tabindex']).toBe('0');
    expect(boris?.injector.get(Tooltip).content).toBe('');
    expect(boris?.attributes['tabindex']).toBeUndefined();
    // the status of an invited student tells until when the link works
    const [active, invited] = fixture.debugElement.queryAll(By.css('li p-tag'));
    expect(invited?.injector.get(Tooltip).content).toBe('Приглашение до 01.10.2026');
    expect(active?.injector.get(Tooltip).content).toBe('');
  });

  it('filters by name and shows deactivated students on demand', async () => {
    await loadStudents([BORIS, MARIA, OLEG]);
    const search = requireElement(host, 'input[aria-label="Поиск по имени"]', HTMLInputElement);

    typeInto(search, 'мар');
    await fixture.whenStable();
    expect(rowsText()).toHaveLength(1);

    typeInto(search, 'нет');
    await fixture.whenStable();
    expect(host.textContent).toContain('Никого не найдено');

    typeInto(search, '');
    requireElement(host, '#show-deactivated', HTMLInputElement).click();
    await fixture.whenStable();
    expect(rowsText().join()).toContain('Олег');
    expect(rowsText().join()).toContain('Отключён');
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

  it('edits a student from the menu', async () => {
    await loadStudents([MARIA]);
    const button = buttonByText(host, 'Действия: Мария');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');

    await act('Мария', 'Изменить');
    flushEverything(); // the room in the dialog
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

  it('resets the password of an active student and re-invites an invited one', async () => {
    await loadStudents([BORIS, MARIA]);

    await act('Мария', 'Сбросить пароль');
    backend.expectOne('/api/teacher/students/m/invite').flush({
      token: 'reset-token',
      purpose: 'PASSWORD_RESET',
      expiresAt: '2026-10-02T10:00:00Z',
    });
    await fixture.whenStable();
    expect(bodyText()).toContain('задаст новый пароль');

    buttonByText(host, 'Действия: Борис').click();
    await fixture.whenStable();
    expect(() => menuItemByText('Сбросить пароль')).toThrow();
    menuItemByText('Новое приглашение').click();
    backend.expectOne('/api/teacher/students/b/invite').flush({
      token: 'new-token',
      purpose: 'ACTIVATION',
      expiresAt: '2026-10-03T10:00:00Z',
    });
    await fixture.whenStable();
    expect(bodyText()).toContain('придумает логин и пароль');
  });

  it('deactivates after confirmation and reactivates', async () => {
    await loadStudents([MARIA]);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      options.accept?.();
      return confirmation;
    });

    await act('Мария', 'Отключить доступ');
    backend
      .expectOne('/api/teacher/students/m/deactivate')
      .flush({ ...MARIA, status: 'DEACTIVATED' });
    await fixture.whenStable();
    expect(rowsText()).toHaveLength(0);
    expect(host.textContent).toContain('Никого не найдено');

    requireElement(host, '#show-deactivated', HTMLInputElement).click();
    await fixture.whenStable();
    expect(rowsText()[0]).toContain('Отключён');
    await act('Мария', 'Вернуть доступ');
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

  it('keeps the rows short: neither groups nor boards nor rooms of a student', async () => {
    await loadStudents(
      [MARIA],
      [aGroup({ name: 'ОГЭ', members: [{ id: 'm', displayName: 'Мария', status: 'ACTIVE' }] })],
    );

    expect(rowsText()[0]).not.toContain('ОГЭ');
    expect(rowsText()[0]).not.toContain('Доски');
    expect(rowsText()[0]).not.toContain('Видеовстреча');
  });

  it('shows the groups under the students and gives them the students to choose from', async () => {
    await loadStudents([MARIA], [aGroup()]);

    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.textContent).toContain('Добавить ученика');
    expect(host.textContent).toContain('Создать группу');
    const panel = fixture.debugElement.query(By.directive(GroupsPanel)).injector.get(GroupsPanel);
    expect(panel.students()).toEqual([MARIA]);
  });
});
