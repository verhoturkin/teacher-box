import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { bodyText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Board } from '../data-access/boards.models';
import { BoardDialog } from './board-dialog';

describe('BoardDialog', () => {
  let fixture: ComponentFixture<BoardDialog>;
  let backend: HttpTestingController;
  let saved: Board[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BoardDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((board) => saved.push(board));
    fixture.componentRef.setInput('students', [{ id: 's-1', name: 'Мария' }]);
    fixture.componentRef.setInput('groups', [{ id: 'g-1', name: 'ОГЭ' }]);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(): Promise<BoardDialog> {
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('creates an Excalidraw board for the students and groups of the filter', async () => {
    fixture.componentRef.setInput('defaults', { studentIds: ['s-1'], groupIds: [] });
    const dialog = await open();
    expect(bodyText()).toContain('Новая доска');
    expect(bodyText()).toContain('Рисуете вместе с учениками');
    expect(document.body.querySelector('#board-url')).toBeNull();
    dialog.form.patchValue({ title: ' Алгебра ', groupIds: ['g-1'] });

    dialog.save();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/boards' });
    expect(create.request.body).toEqual({
      kind: 'EXCALIDRAW',
      title: 'Алгебра',
      url: null,
      studentIds: ['s-1'],
      groupIds: ['g-1'],
    });
    create.flush(aBoard());

    expect(saved).toEqual([aBoard()]);
    expect(dialog.visible()).toBe(false);
  });

  it('creates an external board only with a link', async () => {
    const dialog = await open();
    dialog.form.patchValue({ kind: 'LINK', title: 'Холст', url: 'holst' });
    await fixture.whenStable();
    expect(bodyText()).toContain('портал хранит только её название и ссылку');
    expect(document.body.querySelector('#board-url')).not.toBeNull();

    dialog.save();
    backend.expectNone('/api/teacher/boards');
    dialog.form.patchValue({ url: ' https://app.holst.so/board/1 ' });
    dialog.save();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/boards' });
    expect(create.request.body).toMatchObject({
      kind: 'LINK',
      url: 'https://app.holst.so/board/1',
    });
    create.flush(null, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не удалось сохранить');
    expect(dialog.visible()).toBe(true);
  });

  it('changes a board and keeps members who left', async () => {
    const board = aLinkBoard({
      version: 2,
      members: [
        { type: 'GROUP', id: 'g-1', name: 'ОГЭ' },
        { type: 'STUDENT', id: 'gone', name: null },
      ],
    });
    fixture.componentRef.setInput('board', board);
    const dialog = await open();
    expect(bodyText()).toContain('Изменить доску');
    expect(document.body.querySelector('p-selectbutton')).toBeNull();
    expect(dialog.studentOptions()).toEqual([
      { id: 's-1', name: 'Мария' },
      { id: 'gone', name: 'Нет в списке' },
    ]);
    expect(dialog.form.getRawValue()).toMatchObject({
      title: 'Холст',
      url: 'https://app.holst.so/board/1',
      studentIds: ['gone'],
      groupIds: ['g-1'],
    });

    dialog.save();
    const change = backend.expectOne({ method: 'PUT', url: '/api/teacher/boards/board-2' });
    expect(change.request.body).toEqual({
      title: 'Холст',
      url: 'https://app.holst.so/board/1',
      studentIds: ['gone'],
      groupIds: ['g-1'],
      version: 2,
    });
    change.flush({ ...board, version: 3 });

    expect(saved[0]?.version).toBe(3);
  });

  it('saves once while the request runs', async () => {
    const dialog = await open();
    dialog.form.patchValue({ title: 'Алгебра' });
    dialog.save();
    dialog.save();

    backend.expectOne('/api/teacher/boards').flush(aBoard());
    expect(saved).toHaveLength(1);
  });
});
