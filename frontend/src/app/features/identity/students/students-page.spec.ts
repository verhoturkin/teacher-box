import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { Student } from '../data-access/identity.models';
import { StudentsPage } from './students-page';

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

const MARIA = student({ id: 'm', displayName: 'Мария', status: 'ACTIVE', login: 'maria', note: '5 класс' });
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
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
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

  async function loadStudents(students: Student[]): Promise<void> {
    backend.expectOne('/api/teacher/students').flush(students);
    await fixture.whenStable();
  }

  function rowsText(): string[] {
    return Array.from(host.querySelectorAll('tbody tr')).map((row) => row.textContent);
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

  it('invites the first student', async () => {
    await loadStudents([]);
    expect(host.textContent).toContain('Пока нет ни одного ученика');

    buttonByText(host, 'Добавить ученика').click();
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
    backend.expectOne('/api/teacher/students/m').flush({ ...MARIA, displayName: 'Мария Иванова', version: 1 });
    await fixture.whenStable();

    expect(rowsText()[0]).toContain('Мария Иванова');
  });

  it('issues a new link', async () => {
    await loadStudents([MARIA]);

    buttonByText(host, 'Ссылка: Мария').click();
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
    backend.expectOne('/api/teacher/students/m/deactivate').flush({ ...MARIA, status: 'DEACTIVATED' });
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

  it('stops loading when the list cannot be loaded', async () => {
    backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(host.textContent).toContain('Пока нет ни одного ученика');
  });
});
