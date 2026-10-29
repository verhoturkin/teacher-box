import { ChangeDetectionStrategy, Component, input, model, output, viewChild } from '@angular/core';
import { AssistChip } from '@shared/ui/assist-chip';
import { T } from '../i18n/texts';
import { FilePicker } from './file-picker';

/**
 * «Материалы»: the assist chips that add what an assignment has no yet — a photo (phone), a file, a textbook,
 * a video, a test with questions, a board. The files go into the `files` model, the rest is the host's.
 */
@Component({
  selector: 'tb-material-chips',
  imports: [AssistChip, FilePicker],
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
        <tb-assist-chip icon="co_present" [disabled]="onBoard()" (click)="board.emit()">
          {{ t.board }}
        </tb-assist-chip>
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
  readonly onBoard = input(false);
  readonly textbook = output();
  readonly video = output();
  readonly quiz = output();
  readonly board = output();
}
