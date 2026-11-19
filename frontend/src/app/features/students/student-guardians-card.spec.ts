import { HttpTestingController } from '@angular/common/http/testing';
import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgControl } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { aGuardian, aStudent } from '@testing/identity-fixtures';
import { bodyText, buttonByText, hostElement, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Guardian, Student } from '@features/identity/parts';
import { StudentGuardiansCard } from './student-guardians-card';

const GUARDIANS = '/api/teacher/students/student-1/guardians';
const VISIBILITY = '/api/teacher/billing/students/student-1/visibility';

describe('StudentGuardiansCard', () => {
  let fixture: ComponentFixture<StudentGuardiansCard>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let messages: MessageService;

  async function render(
    guardians: readonly Guardian[] = [],
    student: Student = aStudent(),
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StudentGuardiansCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(StudentGuardiansCard);
    fixture.componentRef.setInput('student', student);
    host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne(GUARDIANS).flush(guardians);
    await fixture.whenStable();
    await visibility(guardians.length > 0);
  }

  async function visibility(hasGuardians: boolean, guardiansOnly = false): Promise<void> {
    backend.expectOne(VISIBILITY).flush({ studentId: 'student-1', guardiansOnly, hasGuardians });
    await fixture.whenStable();
  }

  function confirmNext(): void {
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      options.accept?.();
      return confirmation;
    });
  }

  function iconButton(label: string): HTMLButtonElement {
    return requireElement(host, `button[aria-label="${label}"]`, HTMLButtonElement);
  }

  async function openDialog(everyone: readonly Guardian[] = []): Promise<void> {
    buttonByText(host, 'Пригласить родителя').click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/guardians').flush(everyone);
    await fixture.whenStable();
  }

  /** «Уже в портале» of the segmented buttons (PrimeNG toggle buttons, not `<button>`s). */
  function existingKind(): HTMLElement {
    const toggle = [...document.body.querySelectorAll<HTMLElement>('p-togglebutton')].find(
      (element) => element.textContent.includes('Уже в портале'),
    );
    if (toggle === undefined) {
      throw new Error('No «Уже в портале»');
    }
    return toggle;
  }

  /** The select of «Уже в портале»: PrimeNG's overlay is not opened in jsdom. */
  function existingField(): DebugElement {
    return fixture.debugElement.query(By.directive(Select));
  }

  function submit(): HTMLButtonElement {
    return requireElement(document.body, 'button[form="guardian-form"]', HTMLButtonElement);
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('says no parent is invited yet and offers to invite one, without the payments switch', async () => {
    await render();

    expect(host.textContent).toContain('Родители');
    expect(host.textContent).toContain('Родитель пока не приглашён');
    expect(host.textContent).toContain('только для чтения');
    expect(buttonByText(host, 'Пригласить родителя')).toBeTruthy();
    expect(host.querySelector('#payments-guardians-only')).toBeNull();
  });

  it('lists the parents with their state and the payments switch', async () => {
    await render([
      aGuardian(),
      aGuardian({
        id: 'guardian-2',
        displayName: 'Олег',
        status: 'INVITED',
        login: null,
        pendingInvite: { purpose: 'ACTIVATION', expiresAt: '2026-12-01T10:00:00Z' },
      }),
    ]);

    const rows = host.querySelectorAll('ul.tb-list > li');
    expect(rows.length).toBe(2);
    expect(rows[0]?.textContent).toContain('Анна');
    expect(rows[0]?.textContent).toContain('Входит как anna');
    expect(rows[1]?.textContent).toContain('Приглашение до 01.12.2026');
    expect(iconButton('Сбросить пароль: Анна')).toBeTruthy();
    expect(iconButton('Новое приглашение: Олег')).toBeTruthy();
    // two parents: no room for a third
    expect(() => buttonByText(host, 'Пригласить родителя')).toThrow();
    expect(host.textContent).toContain('Оплаты видит только родитель');
  });

  it('tells the other states of a parent', async () => {
    await render([
      aGuardian({
        pendingInvite: { purpose: 'PASSWORD_RESET', expiresAt: '2026-12-01T10:00:00Z' },
      }),
      aGuardian({ id: 'guardian-2', displayName: 'Олег', status: 'INVITED', login: null }),
    ]);

    expect(host.textContent).toContain('Ссылка для нового пароля до 01.12.2026');
    expect(host.textContent).toContain('Приглашён, ссылки нет');
  });

  it('offers no invitation for a deactivated student', async () => {
    await render([], aStudent({ status: 'DEACTIVATED' }));

    expect(() => buttonByText(host, 'Пригласить родителя')).toThrow();
  });

  it('invites a new parent by name and shows the link to send', async () => {
    await render();
    await openDialog();

    expect(bodyText()).not.toContain('Кого пригласить');
    submit().click();
    await fixture.whenStable();
    backend.expectNone(GUARDIANS);
    expect(bodyText()).toContain('Заполните поле');

    typeInto(requireElement(document.body, '#guardian-name', HTMLInputElement), ' Анна ');
    await fixture.whenStable();
    submit().click();
    const request = backend.expectOne({ method: 'POST', url: GUARDIANS });
    expect(request.request.body).toEqual({ displayName: 'Анна' });
    request.flush({
      guardian: aGuardian({ status: 'INVITED', login: null }),
      invite: { token: 'tok', purpose: 'ACTIVATION', expiresAt: '2026-12-01T10:00:00Z' },
    });
    await fixture.whenStable();
    await visibility(true);

    expect(host.querySelectorAll('ul.tb-list > li').length).toBe(1);
    expect(bodyText()).toContain('Ссылка для родителя: Анна');
    expect(bodyText()).toContain('Отправьте родителю эту ссылку');
    expect(requireElement(document.body, '#invite-link', HTMLInputElement).value).toBe(
      `${window.location.origin}/invite/tok`,
    );
  });

  it('shows why a parent was not added', async () => {
    await render();
    await openDialog();
    typeInto(requireElement(document.body, '#guardian-name', HTMLInputElement), 'Анна');
    await fixture.whenStable();
    submit().click();
    backend
      .expectOne({ method: 'POST', url: GUARDIANS })
      .flush(
        { status: 422, code: 'guardian.limit' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('не больше двух родителей');
  });

  it('links a parent already on the portal, leaving out the linked ones', async () => {
    const anna = aGuardian();
    const oleg = aGuardian({ id: 'guardian-2', displayName: 'Олег', studentIds: ['student-2'] });
    await render([anna]);
    await openDialog([anna, oleg]);

    existingKind().click();
    await fixture.whenStable();
    expect(existingField().injector.get(Select).options).toEqual([oleg]);
    expect(bodyText()).toContain('брата или сестры');

    submit().click();
    await fixture.whenStable();
    backend.expectNone(`${GUARDIANS}/link`);

    existingField().injector.get(NgControl).control?.setValue('guardian-2');
    await fixture.whenStable();
    submit().click();
    const request = backend.expectOne({ method: 'POST', url: `${GUARDIANS}/link` });
    expect(request.request.body).toEqual({ guardianId: 'guardian-2' });
    request.flush({ ...oleg, studentIds: ['student-2', 'student-1'] });
    await fixture.whenStable();
    await visibility(true);

    expect(host.querySelectorAll('ul.tb-list > li').length).toBe(2);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Родитель привязан' }),
    );
  });

  it('shows why a parent was not linked', async () => {
    const oleg = aGuardian({ id: 'guardian-2', displayName: 'Олег' });
    await render();
    await openDialog([oleg]);
    existingKind().click();
    await fixture.whenStable();
    existingField().injector.get(NgControl).control?.setValue('guardian-2');
    await fixture.whenStable();
    submit().click();
    backend
      .expectOne({ method: 'POST', url: `${GUARDIANS}/link` })
      .flush(
        { status: 409, code: 'guardian.already-linked' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('уже привязан');
  });

  it('offers only a new parent when the portal has none to link', async () => {
    await render();
    buttonByText(host, 'Пригласить родителя').click();
    await fixture.whenStable();
    backend
      .expectOne('/api/teacher/guardians')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(bodyText()).not.toContain('Уже в портале');
    expect(document.body.querySelector('#guardian-name')).not.toBeNull();
  });

  it('issues a new link to a parent and shows it', async () => {
    await render([aGuardian()]);

    iconButton('Сбросить пароль: Анна').click();
    backend
      .expectOne({ method: 'POST', url: `${GUARDIANS}/guardian-1/invite` })
      .flush({ token: 'reset', purpose: 'PASSWORD_RESET', expiresAt: '2026-12-01T10:00:00Z' });
    await fixture.whenStable();

    expect(host.textContent).toContain('Ссылка для нового пароля до 01.12.2026');
    expect(bodyText()).toContain('по ней он задаст новый пароль');
  });

  it('unlinks a parent after confirmation', async () => {
    await render([aGuardian()]);
    confirmNext();

    iconButton('Отвязать: Анна').click();
    await fixture.whenStable();
    backend.expectOne({ method: 'DELETE', url: `${GUARDIANS}/guardian-1` }).flush(null);
    await fixture.whenStable();
    await visibility(false);

    expect(host.textContent).toContain('Родитель пока не приглашён');
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Родитель отвязан' }),
    );
  });

  it('keeps a parent when the unlinking is cancelled', async () => {
    await render([aGuardian({ status: 'DEACTIVATED' })]);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      options.reject?.();
      return confirmation;
    });

    iconButton('Отвязать: Анна').click();
    await fixture.whenStable();

    backend.expectNone(`${GUARDIANS}/guardian-1`);
    expect(host.textContent).toContain('Доступ отключён');
    expect(host.querySelector('button[aria-label="Новое приглашение: Анна"]')).toBeNull();
  });
});
