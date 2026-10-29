import { Injectable } from '@angular/core';
import { MemberSelection } from '@features/identity/parts';
import { BoundTextbook } from '../data-access/homework.models';
import { VideoDraft } from './video-section';

/** What the quick dialog hands to the full editor when «Открыть во весь экран» is pressed. */
export interface NewAssignmentDraft {
  readonly text: string;
  readonly members: readonly MemberSelection[];
  readonly dueAt: Date | null;
  readonly files: readonly File[];
  readonly textbooks: readonly BoundTextbook[];
  readonly videos: readonly VideoDraft[];
}

/** A one-shot hand-over from the quick dialog to the editor of a new assignment. */
@Injectable({ providedIn: 'root' })
export class AssignmentDraftHandover {
  private draft: NewAssignmentDraft | null = null;

  put(draft: NewAssignmentDraft): void {
    this.draft = draft;
  }

  /** The draft, once: a reload or a later «Новое задание» starts clean. */
  take(): NewAssignmentDraft | null {
    const draft = this.draft;
    this.draft = null;
    return draft;
  }
}

const MAX_TITLE = 200;

/** The title of an assignment: its first non-empty line without Markdown marks. */
export function titleOf(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim() !== '') ?? '';
  return line
    .replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim()
    .slice(0, MAX_TITLE);
}
