import { HttpErrorResponse } from '@angular/common/http';
import { UrlTree } from '@angular/router';
import { brokenQuestions, editorAdditions, editorSections, withoutCreate } from './editor-sections';

describe('editor sections', () => {
  it('lists only the shown sections and offers a board until one is chosen', () => {
    expect(
      editorSections({ videos: 0, videoField: false, board: false, questions: 0 }).map(
        (item) => item.id,
      ),
    ).toEqual(['editor-task']);
    expect(
      editorSections({ videos: 0, videoField: true, board: true, questions: 2 }).map(
        (item) => item.id,
      ),
    ).toEqual(['editor-task', 'editor-videos', 'editor-board', 'editor-quiz-summary']);
    expect(editorAdditions(true, false)).toEqual([
      expect.objectContaining({ id: 'video', disabled: true }),
      expect.objectContaining({ id: 'board' }),
    ]);
    expect(editorAdditions(false, true).map((action) => action.id)).toEqual(['video']);
  });

  it('reads the numbers of the broken questions and nothing from other answers', () => {
    const answer = (error: unknown) => new HttpErrorResponse({ status: 422, error });
    expect(
      brokenQuestions(answer({ questions: [{ number: 2 }, { number: 'x' }, null, 5] })),
    ).toEqual([2]);
    expect(brokenQuestions(answer({ questions: 'none' }))).toEqual([]);
    expect(brokenQuestions(answer(null))).toEqual([]);
    expect(brokenQuestions(new Error('offline'))).toEqual([]);
  });

  it('drops «?create=» from the page to go back to', () => {
    const tree = (queryParams: Record<string, string>) =>
      new UrlTree(new UrlTree().root, queryParams, 'top');
    const back = withoutCreate(tree({ create: 'assignment', status: 'OPEN' }));
    expect(back?.queryParams).toEqual({ status: 'OPEN' });
    expect(back?.fragment).toBe('top');
    const plain = tree({ status: 'OPEN' });
    expect(withoutCreate(plain)).toBe(plain);
    expect(withoutCreate(null)).toBeNull();
  });
});
