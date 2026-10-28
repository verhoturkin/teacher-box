import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Tabs } from 'primeng/tabs';
import { payment } from '@testing/billing-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { aStudent } from '@testing/identity-fixtures';
import { scheduledLesson, scheduleSettings } from '@testing/schedule-fixtures';
import { phoneScreen, testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { BroadcastDialog } from '@features/notifications/parts';
import { LessonDialog } from '@features/schedule/parts';
import { PaymentDialog, StudentPaymentsTab } from '@features/billing/parts';
import { Student } from '../data-access/identity.models';
import { StudentRow } from './roster';
import { StudentCard, channelNames } from './student-card';
import { StudentProfileTab } from './student-profile-tab';

/** What the cards of Обзор read: answered by their own specs. */
const OVERVIEW_READS =
  /schedule\/(lessons|students\/[^/]+\/history)|homework\/students\/|billing\/students\/|notifications\/students\/|meetings\/(rooms|calls)/;

function row(student: Partial<Student> = {}, balance: number | null = null): StudentRow {
  const value = aStudent({ id: 'm', displayName: 'Мария', ...student });
  return {
    kind: 'student',
    id: value.id,
    name: value.displayName,
    student: value,
    balance,
    messenger: null,
    next: null,
  };
}

describe('StudentCard', () => {
  let fixture: ComponentFixture<StudentCard>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let success: ReturnType<typeof vi.spyOn>;

  async function render(
    student: StudentRow,
    inputs: Partial<{ channels: readonly string[] | null; single: boolean; busy: boolean }> = {},
    phone = false,
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StudentCard],
      providers: phone ? testProviders(phoneScreen()) : testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    fixture = TestBed.createComponent(StudentCard);
    fixture.componentRef.setInput('student', student);
    fixture.componentRef.setInput('currency', 'RUB');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    host = hostElement(fixture);
    await fixture.whenStable();
  }

  function header(): string {
    return readableText(requireElement(host, 'header', HTMLElement)).replace(/\s/g, ' ');
  }

  /** A component inside the card, typed. */
  function part<T>(type: Type<T>): T {
    return fixture.debugElement.query(By.directive(type)).injector.get(type);
  }

  function overviewReads(pattern: RegExp): number {
    return backend.match((request) => pattern.test(request.urlWithParams)).length;
  }

  afterEach(() => {
    fixture.destroy();
    backend.match((request) => OVERVIEW_READS.test(request.urlWithParams));
    backend.verify();
  });

  it('heads the card with the avatar, the name, «since» and the tags', async () => {
    await render(
      row({ status: 'INVITED', color: 'BLUE', createdAt: '2025-09-01T10:00:00Z' }, 150_000),
      { channels: channelNames(['TELEGRAM', 'VK']) },
    );

    const avatar = requireElement(host, 'tb-avatar', HTMLElement);
    expect(avatar.style.width).toBe('4.5rem');
    expect(avatar.dataset['tbLabel']).toBe('blue');
    expect(requireElement(host, 'h2', HTMLElement).textContent).toBe('Мария');
    const since = formatDate('2025-09-01T10:00:00Z', 'MMMM yyyy', 'en-US');
    expect(header()).toContain(`Мария с ${since} Приглашён Telegram, ВКонтакте Аванс 1 500 ₽`);
    expect(header()).toContain('Написать Оплата Занятие');
    expect(host.querySelector('[aria-label="Действия: Мария"]')).toBeNull();
  });

  it('tags a debt and a missing messenger; a deactivated student gets only «Оплата»', async () => {
    await render(row({}, -300_000), { channels: [] });
    expect(header()).toContain('Без мессенджера Долг 3 000 ₽');

    fixture.componentRef.setInput('student', row({ status: 'DEACTIVATED' }, 0));
    await fixture.whenStable();
    expect(header()).toContain('Отключён');
    expect(header()).not.toContain('мессенджер');
    expect(header()).not.toContain('Написать');
    expect(header()).not.toContain('Занятие');
    expect(header()).toContain('Оплата');
  });

  it('leaves the name and «⋮» to the page header on one pane', async () => {
    await render(row(), { single: true });

    expect(host.querySelector('h2')).toBeNull();
    expect(host.querySelector('[aria-label="Действия: Мария"]')).toBeNull();
  });

  it('makes the three actions tonal on a phone', async () => {
    await render(row(), {}, true);

    expect(buttonByText(host, 'Занятие').classList).toContain('p-button-secondary');
  });

  it('shows Обзор by default and keeps other tabs in the address', async () => {
    await render(row());
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const tabs = Array.from(host.querySelectorAll('[role="tab"]')).map((tab) =>
      tab.textContent.trim(),
    );
    expect(tabs).toEqual(['Обзор', 'Занятия', 'Задания', 'Оплаты', 'Профиль']);
    for (const part of [
      'tb-student-lessons-card',
      'tb-student-tasks-card',
      'tb-student-balance-card',
      'tb-student-channels',
      'tb-room-link',
    ]) {
      expect(host.querySelector(`.tb-student-card__overview ${part}`)).not.toBeNull();
    }
    expect(readableText(host)).toContain('Связь');

    fixture.debugElement.query(By.directive(Tabs)).injector.get(Tabs).value.set('unknown');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: null }, replaceUrl: true }),
    );
  });

  it('names the other tabs in the address and shows the full lists of the features', async () => {
    await render(row());
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.debugElement.query(By.directive(Tabs)).injector.get(Tabs).value.set('payments');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'payments' }, replaceUrl: true }),
    );

    for (const [tab, part] of [
      ['lessons', 'tb-student-lessons-tab'],
      ['homework', 'tb-student-tasks-tab'],
      ['payments', 'tb-student-payments-tab'],
      ['profile', 'tb-student-profile-tab'],
    ] as const) {
      fixture.componentRef.setInput('tab', tab);
      await fixture.whenStable();
      expect(host.querySelector(part)).not.toBeNull();
      expect(host.querySelector('.tb-student-card__overview')).toBeNull();
    }
  });

  it('passes a payment recorded in the header to Оплаты, and a correction there to the list', async () => {
    await render(row());
    fixture.componentRef.setInput('tab', 'payments');
    await fixture.whenStable();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    part(PaymentDialog).saved.emit(payment());
    await fixture.whenStable();
    expect(part(StudentPaymentsTab).revision()).toBe(1);
    expect(changed).toHaveBeenCalledTimes(1);

    part(StudentPaymentsTab).changed.emit();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('passes what Профиль saved and asks for to the page', async () => {
    await render(row(), { busy: true });
    fixture.componentRef.setInput('tab', 'profile');
    await fixture.whenStable();
    const saved = vi.fn();
    const invite = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.invite.subscribe(invite);
    const profile = part(StudentProfileTab);
    expect(profile.busy()).toBe(true);
    expect(profile.student().id).toBe('m');

    const student = aStudent({ id: 'm', displayName: 'Мария Иванова' });
    profile.saved.emit(student);
    profile.invite.emit();

    expect(saved).toHaveBeenCalledWith(student);
    expect(invite).toHaveBeenCalledTimes(1);
  });

  it('writes to the student alone', async () => {
    await render(row());

    buttonByText(host, 'Написать').click();
    await fixture.whenStable();
    expect(document.body.querySelector<HTMLInputElement>('#broadcast-to')?.value).toBe('Мария');

    part(BroadcastDialog).sent.emit(1);
    expect(success).toHaveBeenCalledWith('Сообщение отправлено');
  });

  it('records a payment of the student and reads the balance again', async () => {
    await render(row());
    const changed: unknown[] = [];
    fixture.componentInstance.changed.subscribe(() => changed.push(true));
    overviewReads(/billing\/students\/m/);

    buttonByText(host, 'Оплата').click();
    await fixture.whenStable();
    const dialog = part(PaymentDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.controls.studentId.value).toBe('m');

    dialog.saved.emit(payment());
    await fixture.whenStable();

    expect(success).toHaveBeenCalledWith('Оплата сохранена');
    expect(changed).toHaveLength(1);
    expect(overviewReads(/billing\/students\/m/)).toBe(1);
  });

  it('plans a lesson with the student: the length from the settings, read once', async () => {
    await render(row({ defaultTopic: 'Алгебра' }));

    buttonByText(host, 'Занятие').click();
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(scheduleSettings({ defaultDurationMinutes: 90 }));
    await fixture.whenStable();
    const dialog = part(LessonDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({ owner: 'student:m', durationMinutes: 90, topic: 'Алгебра' }),
    );
    overviewReads(/schedule\/lessons/);

    dialog.saved.emit(scheduledLesson());
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Занятие запланировано');
    expect(overviewReads(/schedule\/lessons/)).toBe(1);

    // the length is known now: the dialog opens without reading the settings again
    buttonByText(host, 'Занятие').click();
    backend.expectNone('/api/me/schedule/settings');
  });

  it('plans a lesson of 60 minutes when the settings cannot be read', async () => {
    await render(row());

    buttonByText(host, 'Занятие').click();
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const dialog = part(LessonDialog);
    expect(dialog.form.controls.durationMinutes.value).toBe(60);
  });

  it('names the messengers, keeping an unknown one as it is', () => {
    expect(channelNames(['MAX', 'OTHER'])).toEqual(['MAX', 'OTHER']);
  });
});
