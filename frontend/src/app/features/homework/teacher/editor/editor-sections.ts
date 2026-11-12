import { HttpErrorResponse } from '@angular/common/http';
import { UrlTree } from '@angular/router';
import { CREATE_PARAM } from '@core/routing/create-param';
import { SectionNavAction, SectionNavItem } from '@shared/ui/section-nav';
import { T } from '@features/homework/i18n/texts';

/** What the «Задание» tab shows besides the text. */
export interface EditorShown {
  readonly videos: number;
  /** The chip «Видео» shows the link field even before the first video. */
  readonly videoField: boolean;
  readonly board: boolean;
  readonly questions: number;
}

/** The section menu of «Задание» (sketch 11): the shown sections, in their order. */
export function editorSections({
  videos,
  videoField,
  board,
  questions,
}: EditorShown): SectionNavItem[] {
  const t = T.editor;
  return [
    { id: 'editor-task', icon: 'tb-i-notes', label: t.sectionTask },
    ...(videos > 0 || videoField
      ? [{ id: 'editor-videos', icon: 'tb-i-smart_display', label: t.sectionVideos(videos) }]
      : []),
    ...(board ? [{ id: 'editor-board', icon: 'tb-i-co_present', label: t.boardTitle }] : []),
    ...(questions > 0
      ? [{ id: 'editor-quiz-summary', icon: 'tb-i-quiz', label: t.sectionQuiz(questions) }]
      : []),
  ];
}

/** «Добавить» of the section menu: a video and, until one is chosen, a board. */
export function editorAdditions(videosFull: boolean, board: boolean): SectionNavAction[] {
  const t = T.editor;
  return [
    { id: 'video', icon: 'tb-i-smart_display', label: t.addVideo, disabled: videosFull },
    ...(board ? [] : [{ id: 'board', icon: 'tb-i-co_present', label: t.addBoard }]),
  ];
}

/** The numbers of the questions in a `homework.quiz-incomplete` answer. */
export function brokenQuestions(error: unknown): number[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [];
  }
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null || !('questions' in body)) {
    return [];
  }
  const list: unknown = body.questions;
  return Array.isArray(list)
    ? (list as unknown[]).flatMap((item) =>
        typeof item === 'object' &&
        item !== null &&
        'number' in item &&
        typeof item.number === 'number'
          ? [item.number]
          : [],
      )
    : [];
}

/** `?create=` («Создать» in the rail) brought the page that opened the editor: going back must not open it again. */
export function withoutCreate(url: UrlTree | null): UrlTree | null {
  if (url === null || !(CREATE_PARAM in url.queryParams)) {
    return url;
  }
  const params = Object.fromEntries(
    Object.entries(url.queryParams).filter(([key]) => key !== CREATE_PARAM),
  );
  return new UrlTree(url.root, params, url.fragment);
}
