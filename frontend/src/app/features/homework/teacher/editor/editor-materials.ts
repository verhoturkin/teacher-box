import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import { Card } from 'primeng/card';
import { Attachment, BoundTextbook } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { AttachmentList } from '@features/homework/ui/attachment-list';
import { MaterialChips } from '@features/homework/ui/material-chips';
import { TextbookList } from '@features/homework/ui/textbook-list';
import { MaterialOpener } from '../material-opener';

/**
 * «Материалы» of the assignment editor: a draft lists its textbooks and saved files and picks new files; the
 * chips add a textbook and, without the section menu, a video or a board.
 */
@Component({
  selector: 'tb-editor-materials',
  imports: [Card, AttachmentList, MaterialChips, TextbookList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-card
      id="editor-materials"
      styleClass="tb-section-card"
      class="tb-editor__materials-card"
      [header]="c.materials"
    >
      <div class="tb-editor__materials tb-list--clamp">
        @if (draft()) {
          <div class="tb-list-group">
            <tb-textbook-list
              [textbooks]="textbooks()"
              [editable]="true"
              [withBoard]="false"
              (opened)="materials.textbook($event)"
              (edit)="editTextbook.emit($event)"
              (remove)="removeTextbook.emit($event)"
            />
            <tb-attachment-list
              [attachments]="savedFiles()"
              [removable]="true"
              (download)="materials.file($event)"
              (remove)="removeFile.emit($event)"
            />
          </div>
        }
        <tb-material-chips
          [(files)]="files"
          [compact]="compact()"
          [withFiles]="draft()"
          [videosFull]="videosFull()"
          [withExtras]="extras()"
          [boardPicked]="boardPicked()"
          (textbook)="bindTextbook.emit()"
          (video)="addVideo.emit()"
          (board)="chooseBoard.emit($event)"
        />
      </div>
    </p-card>
  `,
  styles: `
    .tb-editor__materials {
      display: grid;
      gap: var(--tb-space-2);
    }
  `,
})
export class EditorMaterials {
  protected readonly c = T.create;
  protected readonly materials = inject(MaterialOpener);

  /** A new assignment or a saved draft: it lists and picks files. */
  readonly draft = input.required<boolean>();
  /** «Видео» and «Доска» are chips here (no section menu). */
  readonly extras = input.required<boolean>();
  readonly compact = input.required<boolean>();
  readonly textbooks = input.required<readonly BoundTextbook[]>();
  /** Files saved with a draft. */
  readonly savedFiles = input.required<readonly Attachment[]>();
  readonly videosFull = input.required<boolean>();
  readonly boardPicked = input.required<boolean>();
  /** Files picked, sent with the next save. */
  readonly files = model.required<File[]>();

  readonly editTextbook = output<BoundTextbook>();
  readonly removeTextbook = output<BoundTextbook>();
  readonly removeFile = output<Attachment>();
  readonly bindTextbook = output();
  readonly addVideo = output();
  readonly chooseBoard = output<Event>();
}
