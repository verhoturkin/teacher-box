import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { CreatedStudent } from '../data-access/identity.models';
import { StudentFormDialog } from './student-form-dialog';
import { testProviders } from '@testing/setup';

describe('StudentFormDialog', () => {
  let fixture: ComponentFixture<StudentFormDialog>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StudentFormDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentFormDialog);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(): Promise<void> {
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  function field(id: string): HTMLInputElement {
    return requireElement(document.body, `#${id}`, HTMLInputElement);
  }

  it('creates a student from the name and a contact', async () => {
    const created: CreatedStudent[] = [];
    fixture.componentInstance.created.subscribe((value) => created.push(value));
    await open();
    expect(bodyText()).toContain('Новый ученик');
    // the rest of the profile is on the card's Профиль tab
    expect(document.body.querySelector('#note')).toBeNull();
    expect(document.body.querySelector('tb-label-color-field')).toBeNull();
    expect(document.body.querySelector('tb-room-panel')).toBeNull();

    typeInto(field('displayName'), 'Пётр');
    typeInto(field('phone'), '+7 900');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/students' });
    expect(request.request.body).toEqual({
      displayName: 'Пётр',
      email: null,
      phone: '+7 900',
      note: null,
      defaultTopic: null,
      color: null,
    });
    const response: CreatedStudent = {
      student: {
        id: 's-2',
        displayName: 'Пётр',
        avatar: null,
        email: null,
        phone: '+7 900',
        note: null,
        defaultTopic: null,
        color: null,
        status: 'INVITED',
        login: null,
        createdAt: '2026-09-01T10:00:00Z',
        version: 0,
        pendingInvite: { purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
      },
      invite: { token: 't', purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
    };
    request.flush(response);
    await fixture.whenStable();

    expect(created).toEqual([response]);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('opens empty again after a student was typed in', async () => {
    await open();
    typeInto(field('displayName'), 'Пётр');
    fixture.componentRef.setInput('visible', false);
    await fixture.whenStable();
    await open();

    expect(field('displayName').value).toBe('');
  });

  it('submits from a field: the button of the footer belongs to the form (Enter)', async () => {
    await open();
    typeInto(field('displayName'), 'Пётр');
    typeInto(field('email'), 'petr@example.com');
    await fixture.whenStable();

    expect(buttonByText(document.body, 'Сохранить').form?.id).toBe('student-form');
    requireElement(document.body, '#student-form', HTMLFormElement).requestSubmit();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/students' });
    expect(request.request.body).toMatchObject({ email: 'petr@example.com', phone: null });
  });

  it('shows backend errors and stays open', async () => {
    await open();
    typeInto(field('displayName'), 'Ошибка');
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();

    backend
      .expectOne('/api/teacher/students')
      .flush(
        { status: 422, code: 'profile.email-invalid' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('Некорректный адрес электронной почты');
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('does not submit an empty name', async () => {
    await open();

    buttonByText(document.body, 'Сохранить').click();

    backend.expectNone('/api/teacher/students');
  });

  it('closes on cancel', async () => {
    await open();

    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
