import { Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Observable, catchError, concat, defer, last, map, of, tap, toArray } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { BoardsApi } from '@features/boards/parts';
import { HomeworkApi } from '@features/homework/data-access/homework-api';
import {
  AssignmentDetails,
  Attachment,
  BoundTextbook,
} from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { BoardPick } from '@features/homework/ui/material-chips';

/**
 * The materials the assignment editor adds on a save: the picked files and textbooks, and the board the
 * assignment goes on.
 */
export class EditorMaterialsState {
  private readonly api = inject(HomeworkApi);
  private readonly boards = inject(BoardsApi);

  readonly newFiles = signal<File[]>([]);
  /** Textbooks of a new assignment, bound after it is created. */
  readonly picked = signal<readonly BoundTextbook[]>([]);
  /** Files or textbooks picked and not sent yet. */
  readonly waiting = computed(() => this.newFiles().length + this.picked().length > 0);
  /** The saved textbooks and, in a draft, the picked ones not saved yet (a picked one wins: new pages). */
  readonly textbooks: Signal<readonly BoundTextbook[]>;
  readonly bindVisible = signal(false);
  readonly binding = signal<BoundTextbook | null>(null);
  /** The assignment goes on a board once saved: «Доска». */
  readonly pickedBoard = signal<BoardPick | null>(null);
  readonly boardItems = signal<MenuItem[]>([]);

  constructor(
    private readonly assignment: WritableSignal<AssignmentDetails | null>,
    draft: Signal<boolean>,
  ) {
    this.textbooks = computed(() => {
      const picked = this.picked();
      const saved = (this.assignment()?.textbooks ?? []).filter(
        (textbook) => !picked.some((candidate) => candidate.textbookId === textbook.textbookId),
      );
      return draft() ? [...saved, ...picked] : saved;
    });
  }

  bind(): void {
    this.binding.set(null);
    this.bindVisible.set(true);
  }

  edit(textbook: BoundTextbook): void {
    this.binding.set(textbook);
    this.bindVisible.set(true);
  }

  /** A textbook for a new assignment, or new pages of one already picked. */
  pick(textbook: BoundTextbook): void {
    this.picked.update((picked) => [
      ...picked.filter((candidate) => candidate.textbookId !== textbook.textbookId),
      textbook,
    ]);
  }

  /** A picked textbook goes from the list; a saved one of a draft is unbound at once. */
  remove(textbook: BoundTextbook, failed: (error: unknown) => void): void {
    const picked = this.picked();
    if (picked.some((candidate) => candidate.textbookId === textbook.textbookId)) {
      this.picked.set(picked.filter((candidate) => candidate.textbookId !== textbook.textbookId));
      return;
    }
    const saved = this.assignment();
    if (saved !== null) {
      this.api.unbindTextbook(saved.id, textbook.textbookId).subscribe({
        next: (details) => {
          this.assignment.set(details);
        },
        error: failed,
      });
    }
  }

  /** A file saved with a draft is removed at once. */
  removeFile(file: Attachment, failed: (error: unknown) => void): void {
    const saved = this.assignment();
    if (saved === null) {
      return;
    }
    this.api.removeMaterial(saved.id, file.id).subscribe({
      next: () => {
        this.assignment.update(
          (current) =>
            current && {
              ...current,
              attachments: current.attachments.filter((candidate) => candidate.id !== file.id),
            },
        );
      },
      error: failed,
    });
  }

  /** The teacher's boards, read when the menu opens; an empty list says so instead of showing nothing. */
  loadBoards(): void {
    this.boards.list({}, quietContext()).subscribe((boards) => {
      this.boardItems.set(
        boards.length === 0
          ? [{ label: T.create.noBoards, disabled: true }]
          : boards.map((board) => ({
              label: board.title,
              command: () => {
                this.pickedBoard.set({ id: board.id, title: board.title });
              },
            })),
      );
    });
  }

  /**
   * These files and textbooks, one after another, then off the lists — sent, even if some failed: they are
   * not sent again; `false` when some did not make it (the assignment is saved anyway).
   */
  send(
    id: string,
    files: readonly File[],
    textbooks: readonly BoundTextbook[],
  ): Observable<boolean> {
    return this.add(id, files, textbooks).pipe(
      tap(() => {
        this.newFiles.update((list) => list.filter((file) => !files.includes(file)));
        this.picked.update((list) => list.filter((book) => !textbooks.includes(book)));
      }),
    );
  }

  private add(
    id: string,
    files: readonly File[],
    textbooks: readonly BoundTextbook[],
  ): Observable<boolean> {
    if (files.length === 0 && textbooks.length === 0) {
      return of(true);
    }
    const steps: Observable<boolean>[] = [
      ...(files.length === 0 ? [] : [this.api.uploadMaterials(id, files).pipe(map(() => true))]),
      ...textbooks.map((textbook) =>
        defer(() => this.api.bindTextbook(id, textbook.textbookId, textbook.pages)).pipe(
          map(() => true),
        ),
      ),
    ].map((step) => step.pipe(catchError(() => of(false))));
    return concat(...steps).pipe(
      toArray(),
      map((results) => results.every(Boolean)),
      last(),
    );
  }
}
