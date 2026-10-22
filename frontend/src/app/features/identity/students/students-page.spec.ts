import { HttpTestingController } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import { overview, studentBalance } from '@testing/billing-fixtures';
import {
  bodyText,
  buttonByText,
  hostElement,
  menuItemByText,
  readableText,
  requireElement,
  typeInto,
} from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { channel, studentMessengers } from '@testing/notification-fixtures';
import { scheduledLesson } from '@testing/schedule-fixtures';
import { screenWidth, testProviders } from '@testing/setup';
import { PageDetail } from '@core/routing/page-detail';
import type { ScheduledLesson } from '@features/schedule/parts';
import { Student, StudentGroup } from '../data-access/identity.models';
import { GroupFormDialog } from '../groups/group-form-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { StudentCard } from './student-card';
import { StudentsPage } from './students-page';

const MARIA = aStudent({
  id: 'm',
  displayName: 'Мария',
  login: 'maria',
  note: '5 класс',
  phone: '+7 900 000-00-00',
});
const BORIS = aStudent({
  id: 'b',
  displayName: 'Борис',
  status: 'INVITED',
  login: null,
  pendingInvite: { purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
});
const OLEG = aStudent({ id: 'o', displayName: 'Олег', status: 'DEACTIVATED', login: null });
const OGE = aGroup({
  id: 'g',
  name: 'ОГЭ 9 класс',
  members: [
    { id: 'm', displayName: 'Мария', status: 'ACTIVE' },
    { id: 'b', displayName: 'Борис', status: 'INVITED' },
  ],
});
const SUMMER = aGroup({
  id: 'old',
  name: 'Летняя школа',
  members: [],
  archivedAt: '2026-09-02T10:00:00Z',
});

/** In two hours, so the nearest lesson is «сегодня» or «завтра» whatever the time of the run. */
const SOON = new Date(Date.now() + 2 * 3_600_000);

/** What the tabs of a student's or a group's card read. */
const OVERVIEW_READS =
  /schedule\/lessons\?.*(studentId|groupId)=|homework\/students\/|billing\/(students\/|groups$)|notifications\/students\/|meetings\/(rooms|calls)/;

interface Extras {
  readonly balances?: Record<string, number>;
  readonly withMessenger?: readonly string[];
  readonly lessons?: ScheduledLesson[];
}

describe('StudentsPage', () => {
  let fixture: ComponentFixture<StudentsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function create(
    inputs: { studentId?: string; groupId?: string; tab?: string } = {},
    ...providers: Provider[]
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StudentsPage],
      providers: testProviders(...providers),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentsPage);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    host = hostElement(fixture);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    // the reads of the card's Обзор: its own spec answers them
    backend.match((request) => OVERVIEW_READS.test(request.urlWithParams));
    backend.verify();
  });

  /** Answers the reads of balances, messengers and lessons. */
  function flushExtras(students: readonly Student[], extras: Extras = {}): void {
    const balances = extras.balances ?? {};
    backend
      .expectOne('/api/teacher/billing/overview')
      .flush(
        overview(
          Object.entries(balances).map(([studentId, balance]) =>
            studentBalance({ studentId, balance }),
          ),
        ),
      );
    backend.expectOne('/api/teacher/notifications/students').flush(
      students
        .filter((student) => student.status !== 'DEACTIVATED')
        .map((student) =>
          studentMessengers({
            studentId: student.id,
            channels: (extras.withMessenger ?? []).includes(student.id) ? [channel()] : [],
          }),
        ),
    );
    backend
      .expectOne(
        (request) =>
          request.url === '/api/teacher/schedule/lessons' &&
          !request.params.has('studentId') &&
          !request.params.has('groupId'),
      )
      .flush(extras.lessons ?? []);
  }

  async function load(
    students: Student[],
    groups: StudentGroup[] = [],
    extras: Extras = {},
  ): Promise<void> {
    backend.expectOne('/api/teacher/students').flush(students);
    backend.expectOne('/api/teacher/groups').flush(groups);
    flushExtras(students, extras);
    await fixture.whenStable();
  }

  function rows(): string[] {
    return Array.from(host.querySelectorAll('ul.tb-list[aria-label="Ученики"] > li')).map((row) =>
      readableText(row),
    );
  }

  function chip(label: string): HTMLButtonElement {
    const found = Array.from(
      host.querySelectorAll<HTMLButtonElement>('tb-filter-chips button'),
    ).find((button) => button.textContent.trim().startsWith(label));
    if (found === undefined) {
      throw new Error(`No chip «${label}»`);
    }
    return found;
  }

  async function choose(label: string): Promise<void> {
    chip(label).click();
    await fixture.whenStable();
  }

  /** Opens the card of a row as its link would (the route's parameter). */
  async function openCard(name: string): Promise<void> {
    const link = Array.from(host.querySelectorAll<HTMLAnchorElement>('a.tb-list__link')).find(
      (anchor) => anchor.textContent.trim() === name,
    );
    const [, section, id] = /^\/teacher\/(students|groups)\/(.+)$/.exec(
      link?.getAttribute('href') ?? '',
    ) ?? [undefined, undefined, undefined];
    fixture.componentRef.setInput('studentId', section === 'students' ? id : undefined);
    fixture.componentRef.setInput('groupId', section === 'groups' ? id : undefined);
    await fixture.whenStable();
  }

  /** The «⋮» menu in the card of a row, then one of its items. */
  async function act(name: string, item: string): Promise<void> {
    if (!host.querySelector(`[aria-label="Действия: ${name}"]`)) {
      await openCard(name);
    }
    buttonByText(host, `Действия: ${name}`).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  function confirmNext(): void {
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      options.accept?.();
      return confirmation;
    });
  }

  /** The room panel of an edit dialog asks for the rooms. */
  function flushRoom(): void {
    for (const request of backend.match((request) => request.url.includes('/meetings/'))) {
      request.flush(request.request.url.endsWith('/calls') ? { status: 'OFF', rooms: [] } : []);
    }
  }

  function panes(): string[] {
    return Array.from(host.querySelectorAll('tb-pane')).map(
      (pane) => pane.getAttribute('aria-label') ?? '',
    );
  }

  describe('the list', () => {
    beforeEach(async () => {
      await create();
    });

    it('lists the current students and groups in one list with a supporting line', async () => {
      await load([BORIS, MARIA, OLEG], [OGE, SUMMER], {
        balances: { m: -300_000, b: 150_000 },
        lessons: [
          scheduledLesson({
            studentId: 'm',
            participants: [],
            startsAt: SOON.toISOString(),
            endsAt: new Date(SOON.getTime() + 3_600_000).toISOString(),
          }),
        ],
      });

      const [boris, maria, group, ...rest] = rows();
      expect(rest).toEqual([]);
      expect(boris).toContain('Борис');
      expect(boris).toMatch(/нет занятий · аванс 1\s500 ₽/);
      expect(boris).toContain('Приглашён');
      expect(maria).toMatch(/Мария (сегодня|завтра) \d\d:\d\d/);
      // the debt stands on the right in error, read out as «Долг»
      expect(maria).toMatch(/Долг 3\s000 ₽/);
      expect(maria).not.toContain('Активен');
      expect(host.querySelector('.tb-roster__debt [aria-hidden]')?.textContent).toMatch(
        /^[-−]3\s000\s₽$/,
      );
      expect(group).toContain('ОГЭ 9 класс');
      expect(group).toContain('Мария, Борис · нет занятий');
      expect(host.querySelectorAll('ul.tb-list .tb-list__lead .tb-i-group')).toHaveLength(1);
      expect(host.textContent).toMatch(/2\sученика · 1\sгруппа/);
      // the contacts, the login and the note are in the card, not in the row
      for (const hidden of ['+7 900', 'maria', '5 класс']) {
        expect(maria).not.toContain(hidden);
      }
    });

    it('highlights student avatars and group leads with their colour, keeping row surfaces neutral', async () => {
      await load([{ ...MARIA, color: 'GREEN' }, BORIS], [{ ...OGE, color: 'LIME' }]);

      const [boris, maria, group] = Array.from(host.querySelectorAll('ul.tb-list > li'));
      expect(maria?.hasAttribute('data-tb-label')).toBe(false);
      expect(maria?.querySelector('tb-avatar')?.getAttribute('data-tb-label')).toBe('green');
      expect(boris?.hasAttribute('data-tb-label')).toBe(false);
      expect(boris?.querySelector('tb-avatar')?.hasAttribute('data-tb-label')).toBe(false);
      expect(group?.hasAttribute('data-tb-label')).toBe(false);
      expect(group?.querySelector('.tb-list__lead')?.getAttribute('data-tb-label')).toBe('lime');
    });

    it('opens the card of a student or a group from its row', async () => {
      await load([MARIA], [OGE]);

      const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('a.tb-list__link'));
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/teacher/students/m',
        '/teacher/groups/g',
      ]);
    });

    it('filters by the chips', async () => {
      await load([BORIS, MARIA, OLEG], [OGE, SUMMER], {
        balances: { m: -300_000, o: -100_000 },
        withMessenger: ['m'],
      });

      expect(chip('Все').getAttribute('aria-pressed')).toBe('true');
      expect(readableText(chip('Должники'))).toBe('Должники 2');
      expect(readableText(chip('Без мессенджера'))).toBe('Без мессенджера 1');
      expect(readableText(chip('Группы'))).toBe('Группы');

      await choose('Группы');
      expect(chip('Все').getAttribute('aria-pressed')).toBe('false');
      expect(chip('Группы').getAttribute('aria-pressed')).toBe('true');
      expect(chip('Группы').querySelector('.tb-i-check')).not.toBeNull();
      expect(rows().map((row) => row.split(' ')[0])).toEqual(['ОГЭ']);

      await choose('Должники');
      expect(rows()).toHaveLength(2);
      expect(rows()[1]).toContain('Олег');

      await choose('Без мессенджера');
      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toContain('Борис');

      await choose('Отключённые');
      expect(rows()).toHaveLength(2);
      // a turned-off student who owes shows the debt, not the tag
      expect(rows()[0]).toMatch(/Олег .*Долг 1\s000\s₽/);
      expect(rows()[1]).toContain('Летняя школа');
      expect(rows()[1]).toContain('В архиве');
      expect(rows()[1]).toContain('Пока никого');
    });

    it('filters by the name within the chip', async () => {
      await load([BORIS, MARIA, OLEG]);
      const search = requireElement(host, 'input[aria-label="Поиск по имени"]', HTMLInputElement);

      typeInto(search, 'мар');
      await fixture.whenStable();
      expect(rows()).toHaveLength(1);

      typeInto(search, 'олег');
      await fixture.whenStable();
      expect(host.textContent).toContain('Никого не найдено');
      await choose('Отключённые');
      expect(rows()[0]).toContain('Олег');
    });

    it('goes without balances, messengers and lessons it could not read', async () => {
      backend.expectOne('/api/teacher/students').flush([MARIA]);
      backend.expectOne('/api/teacher/groups').flush([OGE]);
      for (const request of backend.match(() => true)) {
        request.flush(null, { status: 500, statusText: 'Error' });
      }
      await fixture.whenStable();

      expect(rows()[0]).toBe('М Мария');
      expect(rows()[1]).toBe('ОГЭ 9 класс Мария, Борис');
      expect(readableText(chip('Должники'))).toBe('Должники');
    });

    it('invites to add the first student and to create the first group', async () => {
      await load([]);
      expect(host.textContent).toContain('Учеников пока нет');
      // the first action is «Создать» (the rail, the FAB on a phone), not a button in the empty state
      expect(host.querySelector('tb-empty-state button')).toBeNull();

      await choose('Группы');
      expect(host.textContent).toContain('Групп пока нет');
    });

    it('shows a failed load with «Повторить», not «no students»', async () => {
      const groups = backend.expectOne('/api/teacher/groups');
      backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });
      expect(groups.cancelled).toBe(true);
      flushExtras([]);
      await fixture.whenStable();

      expect(host.textContent).toContain('Не удалось загрузить учеников');
      expect(host.textContent).not.toContain('Учеников пока нет');

      buttonByText(host, 'Повторить').click();
      backend.expectOne('/api/teacher/students').flush([]);
      backend.expectOne('/api/teacher/groups').flush([]);
      await fixture.whenStable();
      expect(host.textContent).toContain('Учеников пока нет');
    });
  });

  describe('students', () => {
    beforeEach(async () => {
      await create();
    });

    it('opens the form of a new student from «Создать» and drops ?create', async () => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/?create=student');
      await fixture.whenStable();
      await load([]);

      expect(bodyText()).toContain('Новый ученик');
      expect(router.url).toBe('/');
    });

    it('opens the card of a new student on Профиль and shows the invitation link', async () => {
      await load([MARIA]);
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/?create=student');
      await fixture.whenStable();
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      // the dialog asks only the name and a contact
      expect(document.body.querySelector('p-dialog #note')).toBeNull();

      typeInto(requireElement(document.body, '#displayName', HTMLInputElement), 'Анна');
      await fixture.whenStable();
      buttonByText(document.body, 'Сохранить').click();
      backend.expectOne({ method: 'POST', url: '/api/teacher/students' }).flush({
        student: aStudent({ id: 'a', displayName: 'Анна', status: 'INVITED' }),
        invite: { token: 'new-token', purpose: 'ACTIVATION', expiresAt: '2026-10-01T10:00:00Z' },
      });
      await fixture.whenStable();

      expect(rows()[0]).toContain('Анна');
      expect(bodyText()).toContain('Ссылка для ученика: Анна');
      expect(navigate).toHaveBeenCalledWith(['/teacher/students', 'a'], {
        queryParams: { tab: 'profile' },
      });
    });

    it('shows the debt instead of the tag on the right', async () => {
      await load([BORIS], [], { balances: { b: -80_000 } });

      expect(rows()[0]).toMatch(/Долг 800\s₽/);
      expect(rows()[0]).not.toContain('Приглашён');
    });

    it('tells until when the invitation works', async () => {
      await load([BORIS]);

      const tag = fixture.debugElement.query(By.css('li p-tag'));
      expect(tag.injector.get(Tooltip).content).toBe('Приглашение до 01.10.2026');
    });

    it('keeps the rows without «⋮»: the actions are in the card', async () => {
      await load([MARIA], [OGE]);
      expect(host.querySelector('ul.tb-list button')).toBeNull();

      await openCard('Мария');
      const button = buttonByText(host, 'Действия: Мария');
      expect(button.getAttribute('aria-haspopup')).toBe('menu');
      expect(button.closest('tb-pane:last-child .tb-pane__header header')).not.toBeNull();
    });

    it('has no «Изменить» in the menu: the profile is changed on Профиль', async () => {
      await load([MARIA]);
      await openCard('Мария');
      buttonByText(host, 'Действия: Мария').click();
      await fixture.whenStable();

      expect(() => menuItemByText('Изменить')).toThrow();
      expect(menuItemByText('Сбросить пароль')).toBeTruthy();
    });

    it('saves the profile in place and puts the student in the list', async () => {
      await load([MARIA]);
      fixture.componentRef.setInput('tab', 'profile');
      await openCard('Мария');
      flushRoom();
      await fixture.whenStable();

      typeInto(requireElement(host, '#profile-name', HTMLInputElement), 'Мария Иванова');
      await fixture.whenStable();
      buttonByText(host, 'Сохранить').click();
      backend
        .expectOne({ method: 'PUT', url: '/api/teacher/students/m' })
        .flush({ ...MARIA, displayName: 'Мария Иванова', version: 1 });
      await fixture.whenStable();

      expect(rows()[0]).toContain('Мария Иванова');
      expect(requireElement(host, '#profile-name', HTMLInputElement).value).toBe('Мария Иванова');
    });

    it('issues a new link from Профиль as from «⋮»', async () => {
      await load([BORIS]);
      fixture.componentRef.setInput('tab', 'profile');
      await openCard('Борис');
      await fixture.whenStable();

      buttonByText(host, 'Новое приглашение').click();
      backend.expectOne('/api/teacher/students/b/invite').flush({
        token: 'new-token',
        purpose: 'ACTIVATION',
        expiresAt: '2026-10-03T10:00:00Z',
      });
      await fixture.whenStable();
      expect(bodyText()).toContain('придумает логин и пароль');
    });

    it('resets the password of an active student and re-invites an invited one', async () => {
      await load([BORIS, MARIA]);

      await act('Мария', 'Сбросить пароль');
      backend.expectOne('/api/teacher/students/m/invite').flush({
        token: 'reset-token',
        purpose: 'PASSWORD_RESET',
        expiresAt: '2026-10-02T10:00:00Z',
      });
      await fixture.whenStable();
      expect(bodyText()).toContain('задаст новый пароль');

      await openCard('Борис');
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

    it('deactivates after confirmation and reactivates under «Отключённые»', async () => {
      await load([MARIA]);
      confirmNext();

      await act('Мария', 'Отключить доступ');
      backend
        .expectOne('/api/teacher/students/m/deactivate')
        .flush({ ...MARIA, status: 'DEACTIVATED' });
      await fixture.whenStable();
      expect(rows()).toHaveLength(0);
      expect(host.textContent).toContain('Никого не найдено');

      await choose('Отключённые');
      expect(rows()[0]).toContain('Отключён');
      await act('Мария', 'Вернуть доступ');
      backend.expectOne('/api/teacher/students/m/reactivate').flush(MARIA);
      await fixture.whenStable();
      expect(rows()).toHaveLength(0);
      await choose('Все');
      expect(rows()[0]).toContain('Мария');
    });
  });

  describe('groups', () => {
    beforeEach(async () => {
      await create();
    });

    it('creates a group and opens its card on Профиль', async () => {
      await load([MARIA]);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      fixture.debugElement
        .query(By.directive(StudentFormDialog))
        .injector.get(StudentFormDialog)
        .createGroup.emit();
      await fixture.whenStable();
      expect(bodyText()).toContain('Новая группа');

      const dialog = fixture.debugElement
        .query(By.directive(GroupFormDialog))
        .injector.get(GroupFormDialog);
      expect(dialog.students()).toEqual([MARIA]);
      dialog.created.emit(aGroup({ id: 'g3', name: 'Английский' }));
      await fixture.whenStable();

      expect(rows()[1]).toContain('Английский');
      expect(navigate).toHaveBeenCalledWith(['/teacher/groups', 'g3'], {
        queryParams: { tab: 'profile' },
      });
    });

    it('has no «Изменить» in the group menu: the card has the tabs for it', async () => {
      await load([MARIA], [OGE]);

      await openCard('ОГЭ 9 класс');
      buttonByText(host, 'Действия: ОГЭ 9 класс').click();
      await fixture.whenStable();
      expect(() => menuItemByText('Изменить')).toThrow();
      expect(menuItemByText('В архив')).toBeTruthy();
    });

    it('puts the group saved by its card in the list', async () => {
      await load([MARIA, BORIS], [OGE]);
      fixture.componentRef.setInput('tab', 'members');
      await openCard('ОГЭ 9 класс');

      buttonByText(host, 'Убрать из группы: Борис').click();
      backend
        .expectOne({ method: 'PUT', url: '/api/teacher/groups/g' })
        .flush({ ...OGE, members: [OGE.members[0]], version: 1 });
      await fixture.whenStable();

      expect(rows().find((row) => row.includes('ОГЭ'))).toContain('Мария · нет занятий');
    });

    it('archives after confirmation and restores under «Отключённые»', async () => {
      await load([], [OGE]);
      confirmNext();

      await act('ОГЭ 9 класс', 'В архив');
      backend
        .expectOne('/api/teacher/groups/g/archive')
        .flush({ ...OGE, archivedAt: '2026-09-03T10:00:00Z' });
      await fixture.whenStable();
      expect(rows()).toHaveLength(0);

      await choose('Отключённые');
      await act('ОГЭ 9 класс', 'Вернуть из архива');
      backend.expectOne('/api/teacher/groups/g/restore').flush(OGE);
      await fixture.whenStable();
      await choose('Группы');
      expect(rows()[0]).not.toContain('В архиве');
    });
  });

  describe('the card beside the list', () => {
    it('marks the row of the open card from expanded', async () => {
      await create({ studentId: 'm' }, screenWidth(840));
      await load([BORIS, MARIA]);

      expect(panes()).toEqual(['Список учеников', 'Мария']);
      // beside the card only the list scrolls: the header, the search and the chips stay
      expect(host.querySelector('tb-pane .tb-pane__header tb-search-field')).not.toBeNull();
      expect(host.querySelector('.tb-pane__scroll ul.tb-list')).not.toBeNull();
      expect(host.querySelector('.tb-pane__scroll tb-filter-chips')).toBeNull();
      const current = host.querySelectorAll('ul.tb-list > li.tb-list__item--current');
      expect(current).toHaveLength(1);
      expect(current[0]?.textContent).toContain('Мария');
      expect(current[0]?.querySelector('a')?.getAttribute('aria-current')).toBe('page');
      // the name is the card's own heading beside the list
      expect(host.querySelector('tb-pane:last-child .tb-pane__header h2')?.textContent).toBe(
        'Мария',
      );
      expect(host.querySelector('tb-pane:last-child tb-page-header')).toBeNull();
      expect(host.querySelector('tb-student-card tb-student-lessons-card')).not.toBeNull();
      expect(TestBed.inject(PageDetail).value()).toBe('Мария');
    });

    it('gives the card the messengers, the balance and the tab, and reads them again after a payment', async () => {
      await create({ studentId: 'm', tab: 'unknown' }, screenWidth(1200));
      await load([MARIA], [], { balances: { m: -300_000 }, withMessenger: ['m'] });

      const card = fixture.debugElement.query(By.directive(StudentCard)).injector.get(StudentCard);
      const header = (): string =>
        readableText(
          requireElement(host, 'tb-pane:last-child .tb-pane__header header', HTMLElement),
        );
      expect(header()).toContain('Telegram');
      expect(header()).toMatch(/Долг 3\s000\s₽/);
      expect(card.tab()).toBe('overview');

      card.changed.emit();
      flushExtras([MARIA], { balances: { m: 0 } });
      await fixture.whenStable();
      expect(header()).not.toContain('Долг');
      expect(header()).toContain('Без мессенджера');
    });

    it('opens a group card', async () => {
      await create({ groupId: 'g' }, screenWidth(1200));
      await load([MARIA], [OGE]);

      expect(panes()).toEqual(['Список учеников', 'ОГЭ 9 класс']);
      expect(host.querySelector('tb-pane:last-child .tb-pane__header h2')?.textContent).toBe(
        'ОГЭ 9 класс',
      );
      expect(
        readableText(
          requireElement(host, 'tb-pane:last-child .tb-pane__header header', HTMLElement),
        ),
      ).toContain('2 участника');
      expect(
        buttonByText(host, 'Действия: ОГЭ 9 класс').closest('.tb-pane__header'),
      ).not.toBeNull();
      expect(host.querySelector('tb-group-card tb-student-lessons-card')).not.toBeNull();
    });

    it('asks to choose a row when nothing is open', async () => {
      await create({}, screenWidth(840));
      await load([MARIA]);

      expect(panes()).toEqual(['Список учеников', 'Ученики']);
      expect(host.textContent).toContain('Выберите ученика или группу');
      expect(host.querySelector('li.tb-list__item--current')).toBeNull();
    });

    it('says when the student or the group is not there', async () => {
      await create({ studentId: 'gone' }, screenWidth(840));
      await load([MARIA]);
      expect(host.textContent).toContain('Ученик не найден');

      fixture.componentRef.setInput('studentId', undefined);
      fixture.componentRef.setInput('groupId', 'gone');
      await fixture.whenStable();
      expect(host.textContent).toContain('Группа не найдена');
    });
  });

  describe('one pane at a time', () => {
    for (const width of [599, 600, 839]) {
      it(`shows the list alone at ${String(width)} px`, async () => {
        await create({}, screenWidth(width));
        await load([MARIA]);

        expect(panes()).toEqual(['Список учеников']);
        // one pane: the window scrolls, not the list
        expect(host.querySelector('tb-pane')?.classList).not.toContain('tb-roster__pane');
      });

      it(`shows the card alone with «back» to the list at ${String(width)} px`, async () => {
        await create({ studentId: 'm' }, screenWidth(width));
        await load([MARIA]);

        expect(panes()).toEqual(['Мария']);
        const back = requireElement(host, 'tb-page-header a', HTMLAnchorElement);
        expect(back.getAttribute('href')).toBe('/teacher/students');
        expect(back.getAttribute('aria-label')).toBe('Все ученики');
        expect(host.querySelector('h1')?.textContent).toBe('Мария');
        expect(host.querySelector('tb-page-header [aria-label="Действия: Мария"]')).not.toBeNull();
        // the page header names the student: the card shows no second name
        expect(host.querySelector('tb-pane:last-child .tb-pane__header h2')).toBeNull();
      });
    }

    it('keeps the FAB of a new student on compact only', async () => {
      await create({}, screenWidth(599));
      await load([]);
      expect(host.querySelector('.tb-page-fab')).not.toBeNull();
    });
  });
});
