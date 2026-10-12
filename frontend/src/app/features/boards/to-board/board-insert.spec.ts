import { TestBed } from '@angular/core/testing';
import { BoardInsert, INSERT_TTL_MS } from './board-insert';

describe('BoardInsert', () => {
  let insert: BoardInsert;
  const material = { title: 'Дроби', markdown: 'Решите', mode: 'text' as const };

  beforeEach(() => {
    localStorage.clear();
    insert = TestBed.inject(BoardInsert);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands a material to its board once', () => {
    insert.put('b1', material, 1000);

    expect(insert.take('b2', 1000)).toBeNull();
    expect(insert.take('b1', 1000 + INSERT_TTL_MS)).toEqual(material);
    expect(insert.take('b1', 1000)).toBeNull();
  });

  it('forgets an old or a broken material', () => {
    insert.put('b1', material, 1000);
    expect(insert.take('b1', 1001 + INSERT_TTL_MS)).toBeNull();

    localStorage.setItem('tb.board-insert.b1', '{"title":1}');
    expect(insert.take('b1')).toBeNull();
    localStorage.setItem('tb.board-insert.b1', 'not json');
    expect(insert.take('b1')).toBeNull();
    localStorage.setItem('tb.board-insert.b1', 'null');
    expect(insert.take('b1')).toBeNull();
  });

  it('hands pages of a textbook, only with API addresses', () => {
    const pages = {
      title: 'Spotlight 5, с. 2',
      mode: 'pages' as const,
      pictures: ['/api/teacher/textbooks/tb-1/pages/2'],
    };
    insert.put('b1', pages, 1000);
    expect(insert.take('b1', 1000)).toEqual(pages);

    insert.put('b1', { ...pages, pictures: ['https://evil.example/x.png'] }, 1000);
    expect(insert.take('b1', 1000)).toBeNull();
    localStorage.setItem('tb.board-insert.b1', '{"title":"x","mode":"pages","pictures":3,"at":1}');
    expect(insert.take('b1', 1)).toBeNull();
  });

  it('hands a written assignment with its frame and pictures', () => {
    const assignment = {
      title: 'Дроби',
      markdown: 'Решите',
      mode: 'assignment' as const,
      frame: 'Дроби · 12.10.2026',
      text: 'image' as const,
      pictures: ['/api/teacher/homework/attachments/f-1'],
    };
    insert.put('b1', assignment, 1000);
    expect(insert.take('b1', 1000)).toEqual(assignment);

    insert.put('b1', { ...assignment, pictures: ['https://evil.example/x.png'] }, 1000);
    expect(insert.take('b1', 1000)).toBeNull();
    localStorage.setItem(
      'tb.board-insert.b1',
      '{"title":"x","markdown":"","mode":"assignment","frame":"x","text":"html","pictures":[],"at":1}',
    );
    expect(insert.take('b1', 1)).toBeNull();
    localStorage.setItem('tb.board-insert.b1', '{"title":"x","mode":"text","at":1}');
    expect(insert.take('b1', 1)).toBeNull();
  });

  it('works without the storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => {
      insert.put('b1', material);
    }).not.toThrow();
    expect(insert.take('b1')).toBeNull();
  });
});
