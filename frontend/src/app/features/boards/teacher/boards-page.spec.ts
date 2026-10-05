import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { bodyText, buttonByText, hostElement } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { BoardBackupsDialog } from './board-backups-dialog';
import { BoardDialog } from './board-dialog';
import { BoardsPage } from './boards-page';

describe('BoardsPage', () => {
  let fixture: ComponentFixture<BoardsPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(query: { student?: string; group?: string } = {}): Promise<void> {
    TestBed.configureTestingModule({ imports: [BoardsPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardsPage);
    if (query.student) fixture.componentRef.setInput('student', query.student);
    if (query.group) fixture.componentRef.setInput('group', query.group);
    fixture.detectChanges();
    backend
      .expectOne('/api/teacher/students')
      .flush([
        aStudent({ id: 's-1', displayName: 'Мария' }),
        aStudent({ id: 'gone', status: 'DEACTIVATED' }),
      ]);
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup({ id: 'g-1', name: 'ОГЭ' }),
        aGroup({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
      ]);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('lists every board: the editor link, the kind, who sees it', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([aBoard(), aLinkBoard()]);
    await fixture.whenStable();

    const text = host.textContent;
    expect(text).toContain('Доска Excalidraw');
    expect(text).toContain('Внешняя доска');
    expect(text).toContain('группа «ОГЭ»');
    expect(host.querySelector('a[href$="/board-1"]')).not.toBeNull();
    expect(host.querySelector('a[href="https://app.holst.so/board/1"]')).not.toBeNull();
    expect(host.querySelectorAll('[aria-label^="Резервные копии"]')).toHaveLength(1);
  });

  it('filters by a student from the URL and creates a board for them', async () => {
    await render({ student: 's-1' });
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);
    await fixture.whenStable();
    expect(text()).toContain('У них досок пока нет');

    buttonByText(host, 'Новая доска').click();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(BoardDialog)).injector.get(BoardDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.defaults()).toEqual({ studentIds: ['s-1'], groupIds: [] });
    expect(dialog.students()).toEqual([{ id: 's-1', name: 'Мария' }]);
    expect(dialog.groups()).toEqual([{ id: 'g-1', name: 'ОГЭ' }]);

    dialog.saved.emit(aBoard());
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([aBoard()]);
    await fixture.whenStable();
    expect(text()).toContain('Алгебра');
  });

  it('changes the filter in the URL', async () => {
    await render({ group: 'g-1' });
    backend.expectOne('/api/teacher/boards?groupId=g-1').flush([]);
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;

    page.applyFilter('student:s-1');
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { student: 's-1', group: null },
      queryParamsHandling: 'merge',
    });
    page.applyFilter(null);
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { student: null, group: null },
      queryParamsHandling: 'merge',
    });
  });

  it('edits a board, opens its copies and deletes it after a confirmation', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await fixture.whenStable();

    buttonByText(host, 'Изменить доску: Алгебра').click();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(BoardDialog)).injector.get(BoardDialog);
    expect(dialog.board()).toEqual(aBoard());

    buttonByText(host, 'Резервные копии: Алгебра').click();
    await fixture.whenStable();
    const backups = fixture.debugElement
      .query(By.directive(BoardBackupsDialog))
      .injector.get(BoardBackupsDialog);
    expect(backups.boardId()).toBe('board-1');
    backend.expectOne('/api/teacher/boards/board-1/backups').flush([]);
    backups.restored.emit();
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);

    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');
    buttonByText(host, 'Удалить доску: Алгебра').click();
    const confirmation = confirm.mock.calls[0]?.[0];
    expect(confirmation?.message).toContain('вместе с рисунком');
    confirmation?.accept?.();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/boards/board-1' }).flush(null);
    backend.expectOne('/api/teacher/boards').flush([]);
    await fixture.whenStable();

    expect(text()).toContain('Досок пока нет');
  });

  it('explains what happens to an external board when it is deleted', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([aLinkBoard()]);
    await fixture.whenStable();
    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');

    buttonByText(host, 'Удалить доску: Холст').click();

    expect(confirm.mock.calls[0]?.[0].message).toContain('сама доска в другом сервисе останется');
    expect(bodyText()).not.toContain('Не удалось загрузить');
  });

  function text(): string {
    return host.textContent;
  }
});
