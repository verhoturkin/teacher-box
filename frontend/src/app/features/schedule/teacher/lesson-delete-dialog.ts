import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { EMPTY } from 'rxjs';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { ScheduleApi } from '../data-access/schedule-api';
import { FollowingLessons, RepeatScope, ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';
import { LessonScope } from './lesson-scope';

/**
 * «Удалить занятия?» of a lesson in a series (ADR-0050): an alert with the choice «Только это
 * занятие | Это и следующие» and the number of lessons it touches (`Confirm` holds a text only). A lesson
 * outside a series is deleted by `Confirm.danger` of the card.
 */
@Component({
  selector: 'tb-lesson-delete-dialog',
  imports: [TbDialog, LessonScope],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="alert"
      [(visible)]="visible"
      [headline]="t.deleteSeriesHeader"
      [confirmLabel]="t.deleteLesson"
      confirmSeverity="danger"
      [pending]="submit.pending()"
      [error]="submit.error()"
      (confirm)="send()"
    >
      @if (lesson(); as item) {
        <p class="tb-lesson-delete__text">
          {{ t.deleteWarning }}
          @if (item.status === 'SCHEDULED') {
            {{ t.deleteNotice }}
          }
        </p>
        <tb-lesson-scope [lessonId]="item.id" [(scope)]="scope" [(preview)]="preview" />
      }
    </tb-dialog>
  `,
  styles: `
    .tb-lesson-delete__text {
      margin: 0 0 var(--tb-space-4);
    }
  `,
})
export class LessonDeleteDialog {
  protected readonly t = T.details;
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  /** The id of the lesson that was deleted. */
  readonly deleted = output<string>();

  protected readonly scope = signal<RepeatScope>('ONLY');
  protected readonly preview = signal<FollowingLessons | null>(null);

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    reset: () => {
      this.scope.set('ONLY');
      this.preview.set(null);
    },
    failed: T.details.deleteFailed,
    request: () => {
      const lesson = this.lesson();
      if (lesson === null) {
        return EMPTY;
      }
      return this.api.deleteLesson(
        lesson.id,
        this.scope(),
        lesson.version,
        this.preview()?.repeatVersion ?? lesson.repeatVersion,
      );
    },
    done: () => {
      const lesson = this.lesson();
      if (lesson !== null) {
        this.deleted.emit(lesson.id);
      }
    },
  });

  /** «Это и следующие» waits for the list of the lessons it touches. */
  send(): void {
    if (this.lesson() !== null && !(this.scope() === 'FOLLOWING' && this.preview() === null)) {
      this.submit.run();
    }
  }
}
