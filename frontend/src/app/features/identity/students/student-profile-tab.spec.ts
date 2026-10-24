import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ledger } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { aStudent } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { Student } from '../data-access/identity.models';
import { StudentProfileTab } from './student-profile-tab';

const MARIA = aStudent({
  id: 's-1',
  displayName: 'Мария',
  email: 'maria@example.com',
  note: '5 класс',
  color: 'GREEN',
  version: 2,
});

describe('StudentProfileTab', () => {
  let fixture: ComponentFixture<StudentProfileTab>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(student: Student = MARIA): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentProfileTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentProfileTab);
    fixture.componentRef.setInput('student', student);
    host = hostElement(fixture);
    await fixture.whenStable();
    await flushParts();
  }

  /** The price card and the room panel read their own data: their specs check them. */
  async function flushParts(): Promise<void> {
    backend.match('/api/teacher/billing/students/s-1').forEach((request) => {
      request.flush(ledger({ studentId: 's-1' }));
    });
    for (const request of backend.match((request) => request.url.includes('/meetings/'))) {
      request.flush(request.request.url.endsWith('/calls') ? { status: 'OFF', rooms: [] } : []);
    }
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function field(id: string): HTMLInputElement {
    return requireElement(host, `#${id}`, HTMLInputElement);
  }

  function save(): HTMLButtonElement {
    return buttonByText(requireElement(host, 'form', HTMLFormElement), 'Сохранить');
  }

  it('lays the profile out as cards: data, price, video meeting, sign-in', async () => {
    await render();
    const titles = Array.from(host.querySelectorAll('.p-card-title')).map((title) =>
      title.textContent.trim(),
    );

    expect(titles).toEqual(['Данные ученика', 'Цена занятия', 'Видеовстреча', 'Вход в кабинет']);
    expect(field('profile-name').value).toBe('Мария');
    expect(field('profile-email').value).toBe('maria@example.com');
    expect(requireElement(host, '#profile-note', HTMLTextAreaElement).value).toBe('5 класс');
    expect(
      requireElement(host, 'tb-label-color-field .p-select', HTMLElement).textContent,
    ).toContain('Зелёный');
    expect(field('profile-name').closest('.tb-field')?.classList).toContain('tb-field--required');
  });

  it('keeps «Сохранить» off and hides «Отмена» until a field changes', async () => {
    await render();
    expect(save().disabled).toBe(true);
    expect(host.querySelector('form')?.textContent).not.toContain('Отмена');

    typeInto(field('profile-phone'), '+7 900');
    await fixture.whenStable();

    expect(save().disabled).toBe(false);
    buttonByText(requireElement(host, 'form', HTMLFormElement), 'Отмена').click();
    await fixture.whenStable();
    expect(field('profile-phone').value).toBe('');
    expect(save().disabled).toBe(true);
  });

  it('saves the changed fields in place with the version of the student', async () => {
    await render();
    const saved: Student[] = [];
    fixture.componentInstance.saved.subscribe((student) => saved.push(student));

    typeInto(field('profile-email'), '');
    typeInto(field('profile-topic'), ' Физика ');
    await fixture.whenStable();
    requireElement(host, 'tb-label-color-field .p-select', HTMLElement).click();
    await fixture.whenStable();
    requireElement(document.body, 'li[aria-label="Синий"]', HTMLElement).click();
    await fixture.whenStable();
    save().click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/students/s-1' });
    expect(request.request.body).toEqual({
      displayName: 'Мария',
      email: null,
      phone: null,
      note: '5 класс',
      defaultTopic: 'Физика',
      color: 'BLUE',
      version: 2,
    });
    const response = { ...MARIA, email: null, defaultTopic: 'Физика', color: 'BLUE', version: 3 };
    request.flush(response);
    await fixture.whenStable();

    expect(saved).toEqual([response]);
  });

  it('fills the form again with the saved student, and with another one', async () => {
    await render();
    typeInto(field('profile-phone'), '+7 900');
    fixture.componentRef.setInput('student', { ...MARIA, phone: '+7 900', version: 3 });
    await fixture.whenStable();
    expect(field('profile-phone').value).toBe('+7 900');
    expect(save().disabled).toBe(true);

    fixture.componentRef.setInput('student', aStudent({ id: 's-1', displayName: 'Пётр' }));
    await fixture.whenStable();
    expect(field('profile-name').value).toBe('Пётр');
    // the room panel reads again only for the new name
    await flushParts();
  });

  it('keeps what was typed when only the invitation of the student changed', async () => {
    await render();
    typeInto(field('profile-phone'), '+7 900');
    fixture.componentRef.setInput('student', {
      ...MARIA,
      pendingInvite: { purpose: 'PASSWORD_RESET', expiresAt: '2026-10-02T10:00:00Z' },
    });
    await fixture.whenStable();

    expect(field('profile-phone').value).toBe('+7 900');
  });

  it('shows a backend error under the field and keeps the form', async () => {
    await render();
    typeInto(field('profile-email'), 'bad@example');
    await fixture.whenStable();
    save().click();

    backend
      .expectOne('/api/teacher/students/s-1')
      .flush(
        { status: 422, code: 'profile.email-invalid' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(readableText(host)).toContain('Некорректный адрес электронной почты');
    expect(field('profile-email').value).toBe('bad@example');
  });

  it('shows a failure it cannot place under a field', async () => {
    await render();
    typeInto(field('profile-phone'), '+7 900');
    await fixture.whenStable();
    save().click();

    backend
      .expectOne('/api/teacher/students/s-1')
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(host.querySelector('p-message')).not.toBeNull();
  });

  it('does not save an empty name', async () => {
    await render();
    typeInto(field('profile-name'), '');
    await fixture.whenStable();
    save().click();
    await fixture.whenStable();

    backend.expectNone('/api/teacher/students/s-1');
  });

  it('shows the login read-only and resets the password of an active student', async () => {
    await render();
    const invite = vi.fn();
    fixture.componentInstance.invite.subscribe(invite);

    expect(field('profile-login').value).toBe('maria');
    expect(field('profile-login').readOnly).toBe(true);
    buttonByText(host, 'Сбросить пароль').click();

    expect(invite).toHaveBeenCalledTimes(1);
  });

  it('offers disabling access beside password reset, and restoring access for disabled students', async () => {
    await render();
    const deactivate = vi.fn();
    const reactivate = vi.fn();
    fixture.componentInstance.deactivate.subscribe(deactivate);
    fixture.componentInstance.reactivate.subscribe(reactivate);
    const reset = buttonByText(host, 'Сбросить пароль');
    const disable = buttonByText(host, 'Отключить доступ');
    expect(disable.closest('.tb-form-actions')).toBe(reset.closest('.tb-form-actions'));
    disable.click();
    expect(deactivate).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('student', { ...MARIA, status: 'DEACTIVATED' });
    await fixture.whenStable();
    buttonByText(host, 'Вернуть доступ').click();
    expect(reactivate).toHaveBeenCalledTimes(1);
  });

  it('tells until when the invitation of an invited student works', async () => {
    await render(
      aStudent({
        id: 's-1',
        status: 'INVITED',
        login: null,
        pendingInvite: { purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
      }),
    );

    expect(field('profile-login').value).toBe('Ещё не выбран');
    expect(readableText(host)).toContain('Ссылка-приглашение действует до 01.10.2026.');
    expect(buttonByText(host, 'Новое приглашение')).toBeTruthy();
  });

  it('tells until when the link of a new password works', async () => {
    await render(
      aStudent({
        id: 's-1',
        pendingInvite: { purpose: 'PASSWORD_RESET', expiresAt: '2026-10-02T10:00:00Z' },
      }),
    );

    expect(readableText(host)).toContain('Ссылка для нового пароля действует до 02.10.2026.');
  });

  it('has neither the video meeting nor a link for a deactivated student', async () => {
    await render(aStudent({ id: 's-1', status: 'DEACTIVATED' }));

    expect(readableText(host)).not.toContain('Видеовстреча');
    expect(readableText(host)).toContain('Доступ отключён');
    expect(() => buttonByText(host, 'Сбросить пароль')).toThrow();
  });
});
