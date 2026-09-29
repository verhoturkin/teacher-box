import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { injectMobile } from '@core/layout/mobile';
import { JoinLessonButton } from '@features/meetings/parts';
import { ChangeKind } from '../data-access/schedule.models';

/**
 * The student's buttons of a lesson: «Подключиться» when the lesson has a meeting, «Перенести» and
 * «Отменить» («Не приду» in a group). Three buttons do not fit in one line of a phone: there the
 * requests go into the «⋯» menu next to the meeting, so the buttons of a lesson stay in one line
 * (ADR-0021). The host takes no box: the buttons are items of the row they stand in.
 */
@Component({
  selector: 'tb-lesson-actions',
  imports: [Button, Menu, Tooltip, JoinLessonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (joinUrl(); as url) {
      <tb-join-lesson-button [url]="url" [label]="joinLabel()" />
    }
    @if (requests()) {
      @if (folded()) {
        <p-button
          icon="pi pi-ellipsis-v"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          pTooltip="Перенести или отменить"
          [ariaLabel]="'Перенести или отменить: ' + lessonName()"
          (onClick)="menu.toggle($event)"
        />
        <p-menu #menu [model]="items()" [popup]="true" appendTo="body" />
      } @else {
        <p-button
          label="Перенести"
          [icon]="rescheduleIcon()"
          severity="secondary"
          (onClick)="ask.emit('RESCHEDULE')"
        />
        <p-button
          class="tb-button-steady"
          [label]="cancelLabel()"
          severity="danger"
          [text]="true"
          (onClick)="ask.emit('CANCEL')"
        />
      }
    }
  `,
})
export class LessonActions {
  private readonly mobile = injectMobile();

  /** The link of the lesson's meeting; none: no «Подключиться». */
  readonly joinUrl = input<string | null>(null);
  readonly joinLabel = input('Войти в урок');
  /** Whether the student may ask to move or cancel the lesson. */
  readonly requests = input(true);
  /** A group lesson is not cancelled by a student: they will not come. */
  readonly group = input(false);
  /** The lesson in the accessible name of the menu, e.g. its time. */
  readonly lessonName = input('');
  readonly rescheduleIcon = input<string | undefined>(undefined);
  readonly ask = output<ChangeKind>();

  protected readonly cancelLabel = computed(() => (this.group() ? 'Не приду' : 'Отменить'));
  /** On a phone with the meeting button: the requests are in the menu. */
  protected readonly folded = computed(() => this.mobile() && this.joinUrl() !== null);
  protected readonly items = computed<MenuItem[]>(() => [
    {
      label: 'Перенести',
      icon: 'pi pi-calendar',
      command: () => {
        this.ask.emit('RESCHEDULE');
      },
    },
    {
      label: this.cancelLabel(),
      icon: 'pi pi-times',
      styleClass: 'tb-menu-item--danger',
      command: () => {
        this.ask.emit('CANCEL');
      },
    },
  ]);
}
