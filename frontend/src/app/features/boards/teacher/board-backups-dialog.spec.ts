import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoardBackup } from '@testing/boards-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BoardBackup } from '../data-access/boards.models';
import { BoardBackupsDialog } from './board-backups-dialog';

describe('BoardBackupsDialog', () => {
  let fixture: ComponentFixture<BoardBackupsDialog>;
  let backend: HttpTestingController;
  let restored: number;
  const URL = '/api/teacher/boards/board-1/backups';

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BoardBackupsDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardBackupsDialog);
    restored = 0;
    fixture.componentInstance.restored.subscribe(() => restored++);
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.componentRef.setInput('title', 'Алгебра');
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function flushList(
    backups: BoardBackup[] = [aBoardBackup(), aBoardBackup({ id: 'b2', kind: 'DAILY' })],
  ): Promise<void> {
    backend.expectOne(URL).flush(backups);
    await fixture.whenStable();
  }

  function button(predicate: (button: HTMLButtonElement) => boolean): HTMLButtonElement {
    const found = Array.from(document.body.querySelectorAll('button')).find(predicate);
    if (found === undefined) throw new Error('No such button');
    return found;
  }

  it('lists the copies and makes a new one', async () => {
    await flushList();
    expect(bodyText()).toContain('Резервные копии: Алгебра');
    expect(bodyText()).toContain('Копия учителя');
    expect(bodyText()).toContain('Ежедневная копия');

    buttonByText(document.body, 'Сделать копию').click();
    backend.expectOne({ method: 'POST', url: URL }).flush(aBoardBackup({ id: 'b3' }));
    await flushList([]);

    expect(bodyText()).toContain('Копий пока нет');
  });

  it('restores a copy after a confirmation inside the dialog', async () => {
    await flushList();
    const restore = (): HTMLButtonElement =>
      button(
        (found) => found.getAttribute('aria-label')?.startsWith('Восстановить копию') === true,
      );
    restore().click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Текущий рисунок сохранится копией');

    button((found) => found.textContent.includes('Отмена')).click();
    await fixture.whenStable();
    expect(bodyText()).not.toContain('Текущий рисунок сохранится копией');

    restore().click();
    await fixture.whenStable();
    button(
      (found) => found.closest('.p-message') !== null && found.textContent.includes('Восстановить'),
    ).click();
    backend
      .expectOne({ method: 'POST', url: `${URL}/backup-1/restore` })
      .flush(aBoardBackup({ id: 'b4' }));
    await flushList();

    expect(restored).toBe(1);
  });

  it('deletes a copy and shows a failure', async () => {
    await flushList();
    const dialog = fixture.componentInstance;
    dialog.ask('delete', aBoardBackup());
    await fixture.whenStable();
    expect(bodyText()).toContain('Удалить копию от');

    dialog.confirm({ kind: 'delete', backup: aBoardBackup() });
    backend
      .expectOne({ method: 'DELETE', url: `${URL}/backup-1` })
      .flush(
        { code: 'boards.backup-not-found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    expect(bodyText()).toContain('Такой копии уже нет');

    dialog.confirm({ kind: 'delete', backup: aBoardBackup() });
    backend.expectOne({ method: 'DELETE', url: `${URL}/backup-1` }).flush(null);
    await flushList([]);
    expect(restored).toBe(0);
  });

  it('does nothing without a board', async () => {
    await flushList([]);
    fixture.componentRef.setInput('boardId', null);
    await fixture.whenStable();
    const dialog = fixture.componentInstance;

    dialog.load();
    dialog.create();
    dialog.confirm({ kind: 'restore', backup: aBoardBackup() });
  });
});
