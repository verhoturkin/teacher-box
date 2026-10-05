import { aBoard } from '@testing/boards-fixtures';
import { boardMembersText, boardRoute } from './boards-labels';

describe('boards labels', () => {
  it('names the students and groups of a board', () => {
    expect(
      boardMembersText(
        aBoard({
          members: [
            { type: 'STUDENT', id: 's', name: 'Мария' },
            { type: 'GROUP', id: 'g', name: 'ОГЭ' },
            { type: 'STUDENT', id: 'gone', name: null },
          ],
        }),
      ),
    ).toBe('Мария, группа «ОГЭ»');
    expect(boardMembersText(aBoard({ members: [] }))).toBe('никому не открыта');
  });

  it('routes a board to the editor of the area', () => {
    expect(boardRoute('teacher', 'b1')).toBe('/teacher/boards/b1');
    expect(boardRoute('cabinet', 'b1')).toBe('/cabinet/boards/b1');
  });
});
