import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { CreatedStudent, Student } from '../data-access/identity.models';
import { StudentFormDialog } from './student-form-dialog';

const STUDENT: Student = {
  id: 's-1',
  displayName: 'Мария',
  email: 'maria@example.com',
  phone: null,
  note: '5 класс',
  status: 'ACTIVE',
  login: 'maria',
  createdAt: '2026-09-01T10:00:00Z',
  version: 2,
  pendingInvite: null,
};

describe('StudentFormDialog', () => {
  let fixture: ComponentFixture<StudentFormDialog>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StudentFormDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentFormDialog);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(student: Student | null): Promise<void> {
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  function field(id: string): HTMLInputElement {
    return requireElement(document.body, `#${id}`, HTMLInputElement);
  }

  it('creates a student', async () => {
    const created: CreatedStudent[] = [];
    fixture.componentInstance.created.subscribe((value) => created.push(value));
    await open(null);
    expect(bodyText()).toContain('Новый ученик');

    typeInto(field('displayName'), 'Пётр');
    typeInto(field('phone'), '+7 900');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/students' });
    expect(request.request.body).toEqual({ displayName: 'Пётр', email: null, phone: '+7 900', note: null });
    const response: CreatedStudent = {
      student: { ...STUDENT, id: 's-2', displayName: 'Пётр', status: 'INVITED' },
      invite: { token: 't', purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
    };
    request.flush(response);
    await fixture.whenStable();

    expect(created).toEqual([response]);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('edits a student with its version', async () => {
    const updated: Student[] = [];
    fixture.componentInstance.updated.subscribe((value) => updated.push(value));
    await open(STUDENT);
    expect(bodyText()).toContain('Редактирование');
    expect(field('displayName').value).toBe('Мария');
    expect(requireElement(document.body, '#note', HTMLTextAreaElement).value).toBe('5 класс');

    typeInto(field('email'), '');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/students/s-1' });
    expect(request.request.body).toEqual({
      displayName: 'Мария',
      email: null,
      phone: null,
      note: '5 класс',
      version: 2,
    });
    request.flush({ ...STUDENT, email: null, version: 3 });
    await fixture.whenStable();

    expect(updated.map((student) => student.version)).toEqual([3]);
  });

  it('shows backend errors and stays open', async () => {
    await open(null);
    typeInto(field('displayName'), 'Ошибка');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    backend
      .expectOne('/api/teacher/students')
      .flush({ status: 422, code: 'profile.email-invalid' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Некорректный адрес электронной почты');
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('does not submit an empty name', async () => {
    await open(null);

    buttonByText(document.body, 'Сохранить').click();

    backend.expectNone('/api/teacher/students');
  });

  it('closes on cancel', async () => {
    await open(null);

    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
