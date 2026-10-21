import { aBoard } from '@testing/boards-fixtures';
import { boardMembersText, boardRoute, boardServiceTag } from './boards-labels';

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

  it('names the service of an external board, else its host', () => {
    expect(boardServiceTag('https://canvas.holst.so/board/1')).toBe('Холст');
    expect(boardServiceTag('https://holst.so/b')).toBe('Холст');
    expect(boardServiceTag('https://www.miro.com/app/board/1')).toBe('Miro');
    expect(boardServiceTag('https://www.example.org/x')).toBe('example.org');
    expect(boardServiceTag('not a link')).toBeNull();
    expect(boardServiceTag(null)).toBeNull();
  });
});
