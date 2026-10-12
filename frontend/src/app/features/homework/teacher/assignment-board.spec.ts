import { assignmentDetails, attachment, boundTextbook } from '@testing/homework-fixtures';
import { assignmentBoard } from './assignment-board';

describe('assignmentBoard', () => {
  const today = new Date(2026, 9, 2, 18, 30);

  it('names the frame after the assignment and the day', () => {
    expect(assignmentBoard(assignmentDetails({ title: 'Дроби' }), today).frame).toBe(
      'Дроби · 02.10.2026',
    );
  });

  it('takes the pictures among the files, then the pages of the textbooks', () => {
    const board = assignmentBoard(
      assignmentDetails({
        attachments: [
          attachment({ id: 'pdf', contentType: 'application/pdf' }),
          attachment({ id: 'photo', contentType: 'image/jpeg' }),
          attachment({ id: 'svg', contentType: 'image/svg+xml' }),
        ],
        textbooks: [
          boundTextbook({ textbookId: 'book', pages: '12-13' }),
          boundTextbook({ textbookId: 'scan', format: 'IMAGE', pageCount: 1, pages: null }),
          boundTextbook({ textbookId: 'word', format: 'DOCUMENT', pageCount: 4, pages: null }),
          boundTextbook({ textbookId: 'short', pageCount: 2, pages: null }),
        ],
      }),
      today,
    );

    expect(board.pictures).toEqual([
      '/api/teacher/homework/attachments/photo',
      '/api/teacher/textbooks/book/pages/12',
      '/api/teacher/textbooks/book/pages/13',
      '/api/teacher/textbooks/scan/pages/1',
      '/api/teacher/textbooks/short/pages/1',
      '/api/teacher/textbooks/short/pages/2',
    ]);
  });

  it('puts at most 30 pictures and starts a whole textbook from its first pages', () => {
    const board = assignmentBoard(
      assignmentDetails({
        attachments: [],
        textbooks: [boundTextbook({ textbookId: 'big', pageCount: 120, pages: null })],
      }),
      today,
    );

    expect(board.pictures).toHaveLength(30);
    expect(board.pictures[29]).toBe('/api/teacher/textbooks/big/pages/30');
    expect(
      assignmentBoard(
        assignmentDetails({
          attachments: [],
          textbooks: [boundTextbook({ pageCount: null, pages: null })],
        }),
        today,
      ).pictures,
    ).toEqual(['/api/teacher/textbooks/tb-1/pages/1']);
  });
});
