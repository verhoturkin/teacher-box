import { formatDate } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Tabs } from 'primeng/tabs';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { scheduledLesson, scheduleSettings } from '@testing/schedule-fixtures';
import { phoneScreen, testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { StudentTasksTab } from '@features/homework/parts';
import { BroadcastDialog } from '@features/notifications/parts';
import { LessonDialog, StudentLessonsTab } from '@features/schedule/parts';
import { StudentGroup } from '../data-access/identity.models';
import { GroupCard } from './group-card';
import { GroupMembersTab } from './group-members-tab';
import { GroupProfileTab } from './group-profile-tab';

/** What the tabs read: answered by their own specs. */
const TAB_READS =
  /schedule\/(lessons|groups\/[^/]+\/history)|homework\/students\/|billing\/groups|meetings\/(rooms|calls)/;

const OGE = aGroup({
  id: 'g',
  name: 'ОГЭ',
  color: 'LIME',
  defaultTopic: 'Дроби',
  createdAt: '2025-09-01T10:00:00Z',
  members: [
    { id: 'm', displayName: 'Мария', status: 'ACTIVE' },
    { id: 'b', displayName: 'Борис', status: 'INVITED' },
    { id: 'o', displayName: 'Олег', status: 'DEACTIVATED' },
  ],
});

describe('GroupCard', () => {
  let fixture: ComponentFixture<GroupCard>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let success: ReturnType<typeof vi.spyOn>;

  async function render(
    group: StudentGroup = OGE,
    inputs: Partial<{ single: boolean; tab: string }> = {},
    phone = false,
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [GroupCard],
      providers: phone ? testProviders(phoneScreen()) : testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    fixture = TestBed.createComponent(GroupCard);
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('students', [aStudent({ id: 'v', displayName: 'Вера' })]);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    host = hostElement(fixture);
    await fixture.whenStable();
  }

  function header(): string {
    return readableText(requireElement(host, 'header', HTMLElement)).replace(/\s/g, ' ');
  }

  function part<T>(type: Type<T>): T {
    return fixture.debugElement.query(By.directive(type)).injector.get(type);
  }

  function reads(pattern: RegExp): number {
    return backend.match((request) => pattern.test(request.urlWithParams)).length;
  }

  afterEach(() => {
    fixture.destroy();
    backend.match((request) => TAB_READS.test(request.urlWithParams));
    backend.verify();
  });

  it('heads the card as a student’s: the tile in its colour, the name, the members, «since»', async () => {
    await render();

    const tile = requireElement(host, '.tb-group-card__avatar', HTMLElement);
    expect(tile.dataset['tbLabel']).toBe('lime');
    expect(tile.querySelector('.tb-i-group')).not.toBeNull();
    expect(requireElement(host, 'h2', HTMLElement).textContent).toBe('ОГЭ');
    const since = formatDate('2025-09-01T10:00:00Z', 'MMMM yyyy', 'en-US');
    expect(header()).toContain(`ОГЭ 3 участника · с ${since}`);
    expect(header()).toContain('Написать Занятие');
    expect(header()).not.toContain('Оплата');
    expect(buttonByText(host, 'Действия: ОГЭ').getAttribute('aria-haspopup')).toBe('menu');
  });

  it('tags an archived group and leaves it neither «Написать» nor «Занятие»', async () => {
    await render({ ...OGE, members: [], archivedAt: '2026-09-02T10:00:00Z' });

    expect(header()).toContain('Пока никого');
    expect(header()).toContain('В архиве');
    expect(header()).not.toContain('Написать');
    expect(header()).not.toContain('Занятие');
    expect(host.querySelector('tb-room-link')).toBeNull();
  });

  it('has no «Написать» for a group without current members', async () => {
    await render({ ...OGE, members: [{ id: 'o', displayName: 'Олег', status: 'DEACTIVATED' }] });

    expect(header()).not.toContain('Написать');
    expect(header()).toContain('Занятие');
  });

  it('leaves the name and «⋮» to the page header on one pane, tonal actions on a phone', async () => {
    await render(OGE, { single: true }, true);

    expect(host.querySelector('h2')).toBeNull();
    expect(host.querySelector('[aria-label="Действия: ОГЭ"]')).toBeNull();
    expect(buttonByText(host, 'Занятие').classList).toContain('p-button-secondary');
  });

  it('asks the page to open «⋮»', async () => {
    await render();
    const opened: Event[] = [];
    fixture.componentInstance.more.subscribe((event) => opened.push(event));

    buttonByText(host, 'Действия: ОГЭ').click();

    expect(opened).toHaveLength(1);
  });

  it('shows Обзор by default: the next lessons of the group and its video meeting', async () => {
    await render();

    const tabs = Array.from(host.querySelectorAll('[role="tab"]')).map((tab) =>
      tab.textContent.trim(),
    );
    expect(tabs).toEqual(['Обзор', 'Занятия', 'Задания', 'Участники', 'Профиль']);
    expect(host.querySelector('.tb-group-card__overview tb-student-lessons-card')).not.toBeNull();
    expect(host.querySelector('.tb-group-card__overview tb-room-link')).not.toBeNull();
    expect(reads(/schedule\/lessons\?.*groupId=g/)).toBe(1);
  });

  it('names the other tabs in the address and gives them the group', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.debugElement.query(By.directive(Tabs)).injector.get(Tabs).value.set('members');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'members' }, replaceUrl: true }),
    );
    fixture.debugElement.query(By.directive(Tabs)).injector.get(Tabs).value.set('overview');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: null } }),
    );

    fixture.componentRef.setInput('tab', 'lessons');
    await fixture.whenStable();
    expect(part(StudentLessonsTab).of()).toEqual({ groupId: 'g' });

    fixture.componentRef.setInput('tab', 'homework');
    await fixture.whenStable();
    expect(part(StudentTasksTab).members()).toEqual(OGE.members);

    fixture.componentRef.setInput('tab', 'members');
    await fixture.whenStable();
    expect(
      part(GroupMembersTab)
        .students()
        .map((student) => student.id),
    ).toEqual(['v']);

    fixture.componentRef.setInput('tab', 'profile');
    await fixture.whenStable();
    expect(part(GroupProfileTab).group()).toBe(OGE);
    expect(host.querySelector('.tb-group-card__overview')).toBeNull();
  });

  it('passes what Участники and Профиль saved to the page', async () => {
    await render(OGE, { tab: 'members' });
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    part(GroupMembersTab).saved.emit(OGE);
    fixture.componentRef.setInput('tab', 'profile');
    await fixture.whenStable();
    part(GroupProfileTab).saved.emit(OGE);

    expect(saved).toHaveBeenCalledTimes(2);
  });

  it('writes to every current member of the group', async () => {
    await render();

    buttonByText(host, 'Написать').click();
    await fixture.whenStable();
    expect(part(BroadcastDialog).toGroup()).toEqual({
      name: 'ОГЭ',
      members: [OGE.members[0], OGE.members[1]],
    });

    part(BroadcastDialog).sent.emit(2);
    expect(success).toHaveBeenCalledWith('Сообщение отправлено');
  });

  it('plans a lesson with the group: the length from the settings, read once', async () => {
    await render();
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    buttonByText(host, 'Занятие').click();
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(scheduleSettings({ defaultDurationMinutes: 90 }));
    await fixture.whenStable();
    const dialog = part(LessonDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({ owner: 'group:g', durationMinutes: 90, topic: 'Дроби' }),
    );
    reads(/schedule\/lessons/);

    dialog.saved.emit(scheduledLesson());
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Занятие запланировано');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(reads(/schedule\/lessons/)).toBe(1);

    buttonByText(host, 'Занятие').click();
    backend.expectNone('/api/me/schedule/settings');
  });

  it('plans a lesson of 60 minutes when the settings cannot be read', async () => {
    await render();

    buttonByText(host, 'Занятие').click();
    backend
      .expectOne('/api/me/schedule/settings')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(part(LessonDialog).form.controls.durationMinutes.value).toBe(60);
  });
});
