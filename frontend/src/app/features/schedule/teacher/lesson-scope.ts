import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { Snackbar } from '@core/snackbar/snackbar';
import { ScheduleApi } from '../data-access/schedule-api';
import { FollowingLessons, RepeatScope } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/**
 * «Только это занятие | Это и следующие» of a lesson in a series (cancel, delete): a single-select
 * list, and under it how many lessons the choice touches. «Это и следующие» asks the server for the
 * affected lessons first; `preview` is `null` until it answers (the dialog does not send before).
 */
@Component({
  selector: 'tb-lesson-scope',
  imports: [FormsModule, Message, RadioButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-list" role="radiogroup" [attr.aria-label]="t.scope">
      @for (option of options; track option.value) {
        <li
          class="tb-lesson-scope__item"
          [class.tb-lesson-scope__item--checked]="scope() === option.value"
        >
          <p-radiobutton
            class="tb-lesson-scope__radio"
            name="lesson-scope"
            [inputId]="'lesson-scope-' + option.value"
            [value]="option.value"
            [ngModel]="scope()"
            (ngModelChange)="choose($event)"
          />
          <label class="tb-list__text" [for]="'lesson-scope-' + option.value">
            <span class="tb-list__title">{{ option.label }}</span>
          </label>
        </li>
      }
    </ul>
    @if (preview(); as affected) {
      <p-message severity="info" styleClass="tb-lesson-scope__note">{{
        t.affected(affected.affected.length, affected.protectedLessons.length)
      }}</p-message>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    /* The whole tile selects: the label covers it; the radio stays above for its own focus ring. */
    .tb-lesson-scope__item {
      position: relative;
      cursor: pointer;

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--tb-list-item)
        );
      }

      label {
        cursor: pointer;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
        }
      }

      .tb-lesson-scope__radio {
        grid-area: lead;
        position: relative;
        z-index: 1;
      }
    }

    /* Our decision (M3 publishes no role for a selected list tile): secondary container. */
    .tb-lesson-scope__item--checked,
    .tb-lesson-scope__item--checked:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    :host ::ng-deep .tb-lesson-scope__note {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class LessonScope {
  protected readonly t = T.lessonDialog;
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly options = [
    { value: 'ONLY' as RepeatScope, label: T.lessonDialog.onlyThis },
    { value: 'FOLLOWING' as RepeatScope, label: T.lessonDialog.thisFollowing },
  ];

  readonly lessonId = input.required<string>();
  readonly scope = model<RepeatScope>('ONLY');
  readonly preview = model<FollowingLessons | null>(null);

  protected choose(scope: RepeatScope): void {
    this.scope.set(scope);
    this.preview.set(null);
    const lessonId = this.lessonId();
    if (scope === 'FOLLOWING') {
      this.api.following(lessonId).subscribe({
        next: (preview) => {
          if (this.scope() === 'FOLLOWING' && this.lessonId() === lessonId) {
            this.preview.set(preview);
          }
        },
        error: () => {
          this.snackbar.error(T.lessonDialog.previewFailed);
        },
      });
    }
  }
}
