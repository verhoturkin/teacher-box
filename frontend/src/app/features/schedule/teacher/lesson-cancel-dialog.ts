import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EMPTY } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { Textarea } from 'primeng/textarea';
import { SHARED_T } from '@shared/i18n/texts';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { ScheduleApi } from '../data-access/schedule-api';
import { FollowingLessons, RepeatScope, ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';
import { LessonScope } from './lesson-scope';

/**
 * «Отменить занятие» as a dialog of its own (ADR-0050), opened by the lesson card once that closed:
 * the reason, «по инициативе ученика» (a lesson with one student), «списать оплату» (when the student
 * asked) and, for a lesson in a series, whether only this one or the following ones too.
 */
@Component({
  selector: 'tb-lesson-cancel-dialog',
  imports: [ReactiveFormsModule, Checkbox, Textarea, TbDialog, LessonScope],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.cancelLesson"
      [confirmLabel]="t.cancelLesson"
      confirmSeverity="danger"
      [cancelLabel]="c.close"
      formId="lesson-cancel-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      @if (lesson(); as item) {
        <form id="lesson-cancel-form" class="tb-form" [formGroup]="form" (ngSubmit)="send()">
          <div class="tb-field">
            <label for="lesson-cancel-reason">{{ t.reason }}</label>
            <textarea
              pTextarea
              id="lesson-cancel-reason"
              rows="2"
              maxlength="500"
              formControlName="reason"
            ></textarea>
          </div>
          @if (item.groupId === null) {
            <label class="tb-switch" for="lesson-cancel-by-student">
              <p-checkbox
                formControlName="byStudent"
                [binary]="true"
                inputId="lesson-cancel-by-student"
              />
              <span>{{ t.byStudent }}</span>
            </label>
          }
          @if (byStudent()) {
            <label class="tb-switch" for="lesson-cancel-charge">
              <p-checkbox formControlName="charge" [binary]="true" inputId="lesson-cancel-charge" />
              <span>{{ t.charge }}</span>
            </label>
          }
          @if (item.seriesId) {
            <tb-lesson-scope [lessonId]="item.id" [(scope)]="scope" [(preview)]="preview" />
          }
        </form>
      }
    </tb-dialog>
  `,
})
export class LessonCancelDialog {
  protected readonly t = T.details;
  protected readonly c = SHARED_T.common;
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly lesson = input<ScheduledLesson | null>(null);
  /** The lesson (or the following ones) was cancelled; the result of the lesson itself. */
  readonly cancelled = output<ScheduledLesson>();

  protected readonly scope = signal<RepeatScope>('ONLY');
  protected readonly preview = signal<FollowingLessons | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    reason: [''],
    byStudent: [false],
    charge: [false],
  });
  protected readonly byStudent = toSignal(this.form.controls.byStudent.valueChanges, {
    initialValue: false,
  });

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    reset: () => {
      this.form.reset();
      this.scope.set('ONLY');
      this.preview.set(null);
    },
    failed: T.details.cancelFailed,
    request: (value) => {
      const lesson = this.lesson();
      if (lesson === null) {
        return EMPTY;
      }
      const reason = value.reason.trim();
      return this.api.cancel(lesson.id, {
        reason: reason === '' ? null : reason,
        byStudent: value.byStudent,
        charge: value.byStudent && value.charge,
        scope: this.scope(),
        version: lesson.version,
        repeatVersion: this.preview()?.repeatVersion ?? lesson.repeatVersion,
      });
    },
    done: (lesson) => {
      this.cancelled.emit(lesson);
    },
  });

  /** «Это и следующие» waits for the list of the lessons it touches. */
  send(): void {
    if (this.lesson() !== null && !(this.scope() === 'FOLLOWING' && this.preview() === null)) {
      this.submit.run();
    }
  }
}
