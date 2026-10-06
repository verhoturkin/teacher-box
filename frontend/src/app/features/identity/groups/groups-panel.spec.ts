import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import {
  bodyText,
  buttonByText,
  hostElement,
  menuItemByText,
  readableText,
  requireElement,
} from '@testing/dom';
import { StudentGroup } from '../data-access/identity.models';
import { GroupFormDialog } from './group-form-dialog';
import { GroupsPanel } from './groups-panel';
import { testProviders } from '@testing/setup';

const CURRENT = aGroup({ id: 'g1', name: 'ОГЭ 9 класс' });
const ARCHIVED = aGroup({
  id: 'g2',
  name: 'Летняя школа',
  archivedAt: '2026-09-02T10:00:00Z',
  members: [],
});

describe('GroupsPanel', () => {
  let fixture: ComponentFixture<GroupsPanel>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupsPanel);
    fixture.componentRef.setInput('students', [aStudent({ id: 'student-1' })]);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function load(groups: StudentGroup[]): Promise<void> {
    backend.expectOne('/api/teacher/groups').flush(groups);
    backend
      .expectOne('/api/teacher/billing/groups')
      .flush({ currency: 'RUB', prices: [{ groupId: 'g1', lessonPrice: 80000 }] });
    await fixture.whenStable();
  }

  function rows(): string[] {
    return Array.from(host.querySelectorAll('ul.tb-list > li')).map((row) => readableText(row));
  }

  /** The «⋮» menu of a group, then one of its items. */
  async function act(name: string, item: string): Promise<void> {
    buttonByText(host, `Действия: ${name}`).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  /** The room panel of the edit dialog asks for the rooms. */
  function flushRoom(): void {
    backend.expectOne('/api/teacher/meetings/rooms').flush([]);
  }

  function confirmNext(): void {
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      options.accept?.();
      return confirmation;
    });
  }

  it('lists current groups with their members only', async () => {
    await load([CURRENT, ARCHIVED]);

    expect(host.querySelector('.p-card-title')?.textContent).toContain('Группы');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('ОГЭ 9 класс');
    expect(rows()[0]).toContain('Мария, Борис');
    expect(rows()[0]).not.toMatch(/800/);
    expect(rows()[0]).not.toContain('Доски');

    requireElement(host, '#show-archived', HTMLInputElement).click();
    await fixture.whenStable();
    expect(rows()[1]).toContain('Летняя школа');
    expect(rows()[1]).toContain('В архиве');
    expect(rows()[1]).toContain('Пока никого');
  });

  it('offers no boards in the menu of a group', async () => {
    await load([CURRENT]);

    const button = buttonByText(host, 'Действия: ОГЭ 9 класс');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(() => menuItemByText('Доски')).toThrow();
    expect(() => menuItemByText('Вернуть из архива')).toThrow();
    menuItemByText('В архив');
  });

  it('invites to create the first group', async () => {
    await load([]);

    expect(host.textContent).toContain('Групп пока нет');
    buttonByText(host, 'Создать группу').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Новая группа');
  });

  it('says when every group is archived', async () => {
    await load([ARCHIVED]);

    expect(host.textContent).toContain('Все группы в архиве');
  });

  it('edits a group with its price and its room', async () => {
    await load([CURRENT]);

    await act('ОГЭ 9 класс', 'Изменить');
    flushRoom();
    await fixture.whenStable();
    expect(bodyText()).toContain('Видеовстреча');
    const form = fixture.debugElement
      .query(By.directive(GroupFormDialog))
      .injector.get(GroupFormDialog);
    expect(form.students().map((student) => student.id)).toEqual(['student-1']);
    const price = requireElement(document.body, '#group-price', HTMLInputElement);
    expect(price.value).toMatch(/800/);
  });

  it('keeps a saved group and its new price', async () => {
    await load([CURRENT]);
    buttonByText(host, 'Создать группу').click();
    await fixture.whenStable();

    const dialog = fixture.debugElement
      .query(By.directive(GroupFormDialog))
      .injector.get(GroupFormDialog);
    dialog.saved.emit({ group: aGroup({ id: 'g3', name: 'Английский' }), lessonPrice: 50000 });
    await fixture.whenStable();

    expect(rows()[0]).toContain('Английский');
    await act('Английский', 'Изменить');
    flushRoom();
    await fixture.whenStable();
    expect(requireElement(document.body, '#group-price', HTMLInputElement).value).toMatch(/500/);
  });

  it('archives after confirmation and restores', async () => {
    await load([CURRENT]);
    confirmNext();

    await act('ОГЭ 9 класс', 'В архив');
    backend
      .expectOne('/api/teacher/groups/g1/archive')
      .flush({ ...CURRENT, archivedAt: '2026-09-03T10:00:00Z' });
    await fixture.whenStable();
    expect(host.textContent).toContain('Все группы в архиве');

    requireElement(host, '#show-archived', HTMLInputElement).click();
    await fixture.whenStable();
    await act('ОГЭ 9 класс', 'Вернуть из архива');
    backend.expectOne('/api/teacher/groups/g1/restore').flush(CURRENT);
    await fixture.whenStable();
    expect(rows()[0]).not.toContain('В архиве');
  });

  it('shows a failed load with «Повторить», not «no groups»', async () => {
    const prices = backend.expectOne('/api/teacher/billing/groups');
    backend.expectOne('/api/teacher/groups').flush(null, { status: 500, statusText: 'Error' });
    expect(prices.cancelled).toBe(true);
    await fixture.whenStable();

    expect(host.textContent).toContain('Не удалось загрузить группы');
    expect(host.textContent).not.toContain('Групп пока нет');
  });
});
