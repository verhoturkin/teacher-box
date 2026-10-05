import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { aRoom, yandexStatus } from '@testing/meetings-fixtures';
import { bodyText, buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { StudentGroup } from '../data-access/identity.models';
import { RoomDialog } from '@features/meetings/parts';
import { aBoard } from '@testing/boards-fixtures';
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
  let changes: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupsPanel);
    fixture.componentRef.setInput('students', [aStudent({ id: 'student-1' })]);
    host = hostElement(fixture);
    changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
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
    backend
      .expectOne('/api/teacher/meetings/rooms')
      .flush([aRoom({ ownerId: 'g1', ownerType: 'GROUP', ownerName: 'ОГЭ 9 класс' })]);
    backend.expectOne('/api/teacher/meetings/yandex').flush(yandexStatus({ status: 'CONNECTED' }));
    backend
      .expectOne('/api/teacher/boards')
      .flush([
        aBoard({ members: [{ type: 'GROUP', id: 'g1', name: 'ОГЭ 9 класс' }] }),
        aBoard({ id: 'board-2', members: [{ type: 'GROUP', id: 'g1', name: 'ОГЭ 9 класс' }] }),
      ]);
    await fixture.whenStable();
  }

  function rows(): string[] {
    return Array.from(host.querySelectorAll('tbody tr')).map((row) => readableText(row));
  }

  function confirmNext(): void {
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementationOnce((options) => {
      options.accept?.();
      return confirmation;
    });
  }

  it('lists current groups with members and price', async () => {
    await load([CURRENT, ARCHIVED]);

    expect(host.querySelector('.p-card-title')?.textContent).toContain('Группы');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('ОГЭ 9 класс');
    expect(rows()[0]).toContain('Мария, Борис');
    expect(rows()[0]).toMatch(/800/);
    expect(rows()[0]).toContain('Телемост');

    requireElement(host, '#show-archived', HTMLInputElement).click();
    await fixture.whenStable();
    expect(rows()[1]).toContain('Летняя школа');
    expect(rows()[1]).toContain('В архиве');
    expect(rows()[1]).toContain('Пока никого');
    expect(rows()[1]).toContain('—');
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

  it('edits a group with its price', async () => {
    await load([CURRENT]);

    buttonByText(host, 'Изменить группу: ОГЭ 9 класс').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Группа');
    const form = fixture.debugElement
      .query(By.directive(GroupFormDialog))
      .injector.get(GroupFormDialog);
    expect(form.students().map((student) => student.id)).toEqual(['student-1']);
    const price = requireElement(document.body, '#group-price', HTMLInputElement);
    expect(price.value).toMatch(/800/);
  });

  it('shows a saved group and its new price', async () => {
    await load([CURRENT]);
    buttonByText(host, 'Создать группу').click();
    await fixture.whenStable();

    const dialog = fixture.debugElement
      .query(By.directive(GroupFormDialog))
      .injector.get(GroupFormDialog);
    dialog.saved.emit({ group: aGroup({ id: 'g3', name: 'Английский' }), lessonPrice: 50000 });
    await fixture.whenStable();

    expect(rows()[0]).toContain('Английский');
    expect(rows()[0]).toMatch(/500/);
    expect(changes).toBe(1);
  });

  it('archives after confirmation and restores', async () => {
    await load([CURRENT]);
    confirmNext();

    buttonByText(host, 'В архив: ОГЭ 9 класс').click();
    backend
      .expectOne('/api/teacher/groups/g1/archive')
      .flush({ ...CURRENT, archivedAt: '2026-09-03T10:00:00Z' });
    await fixture.whenStable();
    expect(host.textContent).toContain('Все группы в архиве');
    expect(changes).toBe(1);

    requireElement(host, '#show-archived', HTMLInputElement).click();
    await fixture.whenStable();
    buttonByText(host, 'Вернуть из архива: ОГЭ 9 класс').click();
    backend.expectOne('/api/teacher/groups/g1/restore').flush(CURRENT);
    await fixture.whenStable();
    expect(rows()[0]).not.toContain('В архиве');
    expect(changes).toBe(2);
  });

  it('shows a failed load with «Повторить», not «no groups»', async () => {
    const prices = backend.expectOne('/api/teacher/billing/groups');
    backend.expectOne('/api/teacher/groups').flush(null, { status: 500, statusText: 'Error' });
    backend.expectOne('/api/teacher/meetings/rooms').flush([]);
    backend.expectOne('/api/teacher/meetings/yandex').flush(yandexStatus());
    backend.expectOne('/api/teacher/boards').flush([]);
    expect(prices.cancelled).toBe(true);
    await fixture.whenStable();

    expect(host.textContent).toContain('Не удалось загрузить группы');
    expect(host.textContent).not.toContain('Групп пока нет');
  });

  it('sets up the video room of a group', async () => {
    await load([CURRENT]);

    buttonByText(host, 'Видеовстреча: ОГЭ 9 класс').click();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(RoomDialog)).injector.get(RoomDialog);
    expect(dialog.canCreate()).toBe(true);
    expect(dialog.room()?.ownerType).toBe('GROUP');

    dialog.changed.emit(null);
    await fixture.whenStable();
    expect(rows()[0]).not.toContain('Телемост');
  });

  it('links the boards of a group', async () => {
    await load([CURRENT]);

    expect(rows()[0]).toContain('Доски (2)');
    expect(host.querySelector('a[href="/teacher/boards?group=g1"]')).not.toBeNull();
  });
});
