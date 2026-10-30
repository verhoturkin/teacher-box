import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { quietContext } from '@core/http/api-error.interceptor';
import { BoardsApi } from '@features/boards/parts';
import { AssistChip } from '@shared/ui/assist-chip';
import { InputChip } from '@shared/ui/input-chip';
import { T } from '../i18n/texts';
import { FilePicker } from './file-picker';

/**
 * «Материалы»: the assist chips that add what an assignment has no yet — a photo (phone), a file, a textbook,
 * a video, a test with questions, a board. The files go into the `files` model, the rest is the host's.
 */
@Component({
  selector: 'tb-material-chips',
  imports: [AssistChip, FilePicker, InputChip, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (withFiles()) {
      <tb-file-picker #filePicker [(files)]="files" [button]="false" />
      <tb-file-picker
        #photoPicker
        [(files)]="files"
        [button]="false"
        [list]="false"
        [capture]="true"
      />
    }
    <div class="tb-material-chips" role="group" [attr.aria-label]="t.materials">
      @if (withFiles()) {
        @if (compact()) {
          <tb-assist-chip icon="photo_camera" (click)="photoPicker()?.choose()">
            {{ t.photo }}
          </tb-assist-chip>
        }
        <tb-assist-chip icon="attach_file" (click)="filePicker()?.choose()">
          {{ t.file }}
        </tb-assist-chip>
        <tb-assist-chip icon="menu_book" (click)="textbook.emit()">{{ t.textbook }}</tb-assist-chip>
      }
      @if (!compact()) {
        <tb-assist-chip icon="smart_display" [disabled]="videosFull()" (click)="video.emit()">
          {{ t.video }}
        </tb-assist-chip>
      }
      <tb-assist-chip icon="quiz" [disabled]="quizDisabled()" (click)="quiz.emit()">
        {{ compact() ? t.quizShort : t.quiz }}
      </tb-assist-chip>
      @if (!compact()) {
        @if (board(); as picked) {
          <tb-input-chip
            [label]="t.boardOn(picked.title)"
            [removeLabel]="t.remove"
            (removed)="board.set(null)"
          >
            <i lead class="tb-i tb-i-co_present" aria-hidden="true"></i>
          </tb-input-chip>
        } @else {
          <tb-assist-chip icon="co_present" (click)="chooseBoard($event, boardMenu)">
            {{ t.board }}
          </tb-assist-chip>
          <p-menu #boardMenu [model]="boardItems()" [popup]="true" appendTo="body" />
        }
      }
    </div>
  `,
  styles: `
    .tb-material-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }
  `,
})
export class MaterialChips {
  protected readonly t = T.create;
  readonly files = model<File[]>([]);
  protected readonly filePicker = viewChild<FilePicker>('filePicker');
  protected readonly photoPicker = viewChild<FilePicker>('photoPicker');
  readonly compact = input(false);
  /** A new assignment takes files and textbooks here; a saved one has them on its page. */
  readonly withFiles = input(true);
  readonly videosFull = input(false);
  readonly quizDisabled = input(false);
  /** The board the assignment goes on once given out; chosen from the menu of the «Доска» chip. */
  readonly board = model<BoardPick | null>(null);
  private readonly boards = inject(BoardsApi);
  protected readonly boardItems = signal<MenuItem[]>([]);
  readonly textbook = output();
  readonly video = output();
  readonly quiz = output();

  /** The boards are read when the menu opens; an empty list says so instead of showing nothing. */
  protected chooseBoard(event: Event, menu: Menu): void {
    menu.toggle(event);
    this.boards.list({}, quietContext()).subscribe((boards) => {
      this.boardItems.set(
        boards.length === 0
          ? [{ label: this.t.noBoards, disabled: true }]
          : boards.map((board) => ({
              label: board.title,
              command: () => {
                this.board.set({ id: board.id, title: board.title });
              },
            })),
      );
    });
  }
}

/** A board of the teacher chosen for an assignment that is not given out yet. */
export interface BoardPick {
  readonly id: string;
  readonly title: string;
}
