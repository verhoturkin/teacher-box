import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard } from '@testing/boards-fixtures';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { Board } from '../data-access/boards.models';
import { BoardsDialog } from './boards-dialog';
import { testProviders } from '@testing/setup';

describe('BoardsDialog', () => {
  let fixture: ComponentFixture<BoardsDialog>;
  let backend: HttpTestingController;
  let saved: Board[];
  let removed: Board[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BoardsDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardsDialog);
    saved = [];
    removed = [];
    fixture.componentInstance.saved.subscribe((board) => saved.push(board));
    fixture.componentInstance.removed.subscribe((board) => removed.push(board));
    fixture.componentRef.setInput('owner', { type: 'STUDENT', id: 's-1', name: 'Мария' });
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(boards: Board[]): Promise<BoardsDialog> {
    fixture.componentRef.setInput('boards', boards);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('adds a board by its link', async () => {
    const dialog = await open([]);
    expect(bodyText()).toContain('Доски: Мария');
    expect(bodyText()).toContain('app.holst.so');

    typeInto(requireElement(document.body, '#board-url', HTMLInputElement), 'holst');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ссылка должна начинаться с http:// или https://');
    dialog.save();
    backend.expectNone('/api/teacher/boards');

    dialog.form.setValue({ title: ' ', url: ' https://app.holst.so/board/1 ' });
    dialog.save();
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/boards' });
    expect(request.request.body).toEqual({
      studentId: 's-1',
      groupId: null,
      title: null,
      url: 'https://app.holst.so/board/1',
    });
    request.flush(aBoard());

    expect(saved).toEqual([aBoard()]);
    expect(dialog.form.getRawValue()).toEqual({ title: '', url: '' });
  });

  it('changes and removes boards', async () => {
    const board = aBoard({ version: 1 });
    const dialog = await open([board]);
    expect(bodyText()).toContain('Алгебра');

    buttonByText(document.body, 'Изменить доску: Алгебра').click();
    await fixture.whenStable();
    expect(dialog.form.getRawValue()).toEqual({
      title: 'Алгебра',
      url: 'https://app.holst.so/board/1',
    });
    expect(bodyText()).toContain('Сохранить');
    dialog.form.setValue({ title: '', url: 'https://app.holst.so/board/2' });
    dialog.save();
    const change = backend.expectOne({ method: 'PUT', url: '/api/teacher/boards/board-1' });
    expect(change.request.body).toEqual({
      title: 'Алгебра',
      url: 'https://app.holst.so/board/2',
      version: 1,
    });
    change.flush(aBoard({ version: 2 }));
    expect(saved).toHaveLength(1);

    buttonByText(document.body, 'Изменить доску: Алгебра').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Отмена').click();
    expect(dialog.form.getRawValue()).toEqual({ title: '', url: '' });

    buttonByText(document.body, 'Удалить доску: Алгебра').click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/boards/board-1' })
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(removed).toEqual([board]);
  });

  it('explains errors', async () => {
    const dialog = await open([]);
    dialog.form.setValue({ title: 'Лишняя', url: 'https://app.holst.so/board/21' });
    dialog.save();
    backend
      .expectOne('/api/teacher/boards')
      .flush(
        { status: 422, code: 'boards.too-many' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(bodyText()).toContain('уже 20 досок');
    expect(saved).toEqual([]);
  });

  it('does nothing without an owner', async () => {
    fixture.componentRef.setInput('owner', null);
    const dialog = await open([]);
    dialog.form.setValue({ title: '', url: 'https://app.holst.so/board/1' });
    dialog.save();
    backend.expectNone('/api/teacher/boards');
  });
});
