import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { JoinLessonButton } from '@features/meetings/parts';
import { ChangeKind } from '../data-access/schedule.models';

/**
 * The student's buttons of a lesson: «Подключиться» when the lesson has a meeting, «Перенести» and
 * «Отменить» («Не приду» in a group). In a row (a computer) they are items of the row they stand
 * in. Stacked (a phone: the bottom sheet of a lesson, the nearest lesson on the home page) the
 * meeting takes the whole width and the requests are an M3 Expressive connected button group of
 * two halves under it (ADR-0022).
 */
@Component({
  selector: 'tb-lesson-actions',
  imports: [Button, JoinLessonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-lesson-actions--stacked]': 'stacked()',
    '[style.display]': "stacked() ? 'flex' : 'contents'",
  },
  template: `
    @if (joinUrl(); as url) {
      <tb-join-lesson-button [url]="url" [label]="joinLabel()" />
    }
    @if (requests()) {
      <div class="tb-button-group" role="group" aria-label="Перенести или отменить">
        <p-button
          label="Перенести"
          [icon]="rescheduleIcon()"
          severity="secondary"
          (onClick)="ask.emit('RESCHEDULE')"
        />
        <p-button
          [class.tb-button-steady]="!stacked()"
          [class.tb-tonal]="stacked()"
          [label]="cancelLabel()"
          severity="danger"
          [text]="!stacked()"
          (onClick)="ask.emit('CANCEL')"
        />
      </div>
    }
  `,
})
export class LessonActions {
  /** The link of the lesson's meeting; none: no «Подключиться». */
  readonly joinUrl = input<string | null>(null);
  readonly joinLabel = input('Войти в урок');
  /** Whether the student may ask to move or cancel the lesson. */
  readonly requests = input(true);
  /** A group lesson is not cancelled by a student: they will not come. */
  readonly group = input(false);
  /** One under another across the width (a phone), not in a row. */
  readonly stacked = input(false);
  readonly rescheduleIcon = input<string | undefined>(undefined);
  readonly ask = output<ChangeKind>();

  protected readonly cancelLabel = computed(() => (this.group() ? 'Не приду' : 'Отменить'));
}
