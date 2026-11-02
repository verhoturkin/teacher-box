import { ChangeDetectionStrategy, Component, input, model, output, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AssistChip } from '@shared/ui/assist-chip';
import { T } from '../i18n/texts';
import { FilePicker } from './file-picker';

/**
 * «Материалы»: the assist chips that add what an assignment has not yet — a photo (phone), a file, a textbook
 * and, where the editor has no section menu for them (`withExtras`), a video and a board. The files go into the
 * `files` model, the rest is the host's.
 */
@Component({
  selector: 'tb-material-chips',
  imports: [AssistChip, FilePicker, NgTemplateOutlet],
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
    <div
      class="tb-material-chips"
      [class.tb-material-chips--grid]="compact()"
      role="group"
      [attr.aria-label]="t.materials"
    >
      @if (withFiles()) {
        <!-- «Фото» first on a phone -->
        @if (compact()) {
          <ng-container [ngTemplateOutlet]="photoChip" />
        }
        <tb-assist-chip
          [class.tb-assist-chip--fill]="compact()"
          icon="attach_file"
          (click)="filePicker()?.choose()"
        >
          {{ t.file }}
        </tb-assist-chip>
        <ng-template #photoChip>
          <tb-assist-chip
            [class.tb-assist-chip--fill]="compact()"
            icon="photo_camera"
            (click)="photoPicker()?.choose()"
          >
            {{ t.photo }}
          </tb-assist-chip>
        </ng-template>
        <tb-assist-chip
          [class.tb-assist-chip--fill]="compact()"
          icon="menu_book"
          (click)="textbook.emit()"
          >{{ t.textbook }}</tb-assist-chip
        >
      }
      @if (withExtras()) {
        <tb-assist-chip icon="smart_display" [disabled]="videosFull()" (click)="video.emit()">
          {{ t.video }}
        </tb-assist-chip>
        @if (!boardPicked()) {
          <tb-assist-chip icon="co_present" (click)="board.emit($event)">
            {{ t.board }}
          </tb-assist-chip>
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

    /* a phone (sketch 6): two chips a row, each half the width */
    .tb-material-chips--grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
  /** «Видео» and «Доска» here: the editor shows them in its section menu when it has one. */
  readonly withExtras = input(true);
  /** A board is chosen already: its section shows it. */
  readonly boardPicked = input(false);
  readonly textbook = output();
  readonly video = output();
  /** «Доска»: the click, for the menu of boards beside the chip. */
  readonly board = output<Event>();
}

/** A board of the teacher chosen for an assignment that is not given out yet. */
export interface BoardPick {
  readonly id: string;
  readonly title: string;
}
