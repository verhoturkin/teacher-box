import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { hideHint, isHintHidden } from '@shared/storage/device-settings';

/** Browser storage key: the teacher hid the first-run checklist. */
export const CHECKLIST_DISMISSED_KEY = 'tb.first-run-checklist.dismissed';

/** Where the teacher is in setting up the portal (`null` while unknown). */
export interface SetupProgress {
  readonly hasStudents: boolean | null;
  readonly priceSet: boolean | null;
  readonly messengerConfigured: boolean | null;
  readonly hasLessons: boolean | null;
}

interface Step {
  readonly done: boolean;
  readonly title: string;
  readonly hint: string;
  readonly link: string;
  readonly query?: Readonly<Record<string, string>>;
}

/** Teacher's home: the steps left after installation and the progress, until they are done or hidden. */
@Component({
  selector: 'tb-first-run-checklist',
  imports: [RouterLink, Button, Card, ProgressBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <p-card header="С чего начать">
        <p-progressbar
          [value]="percent()"
          [showValue]="false"
          styleClass="tb-checklist__progress"
          [attr.aria-label]="'Сделано ' + doneCount() + ' из ' + steps().length"
        />
        <ol class="tb-checklist">
          @for (step of left(); track step.title) {
            <li>
              <i class="pi pi-circle" aria-hidden="true"></i>
              <div>
                <a [routerLink]="step.link" [queryParams]="step.query" class="tb-link">{{
                  step.title
                }}</a>
                <small class="tb-muted">{{ step.hint }}</small>
              </div>
            </li>
          }
        </ol>
        <div class="tb-widget-footer">
          <span class="tb-muted">Сделано {{ doneCount() }} из {{ steps().length }}</span>
          <p-button
            label="Скрыть"
            severity="secondary"
            size="small"
            [text]="true"
            (onClick)="dismiss()"
          />
        </div>
      </p-card>
    }
  `,
  styles: `
    :host ::ng-deep .tb-checklist__progress {
      height: 0.5rem;
      margin-bottom: var(--tb-space-4);
    }

    .tb-checklist {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: var(--tb-space-3);

        > i {
          margin-top: var(--tb-space-1);
          color: var(--p-text-muted-color);
        }

        div {
          display: flex;
          flex-direction: column;
        }
      }
    }
  `,
})
export class FirstRunChecklist {
  readonly progress = input.required<SetupProgress>();

  private readonly dismissed = signal(isHintHidden(CHECKLIST_DISMISSED_KEY));

  protected readonly steps = computed((): Step[] => {
    const progress = this.progress();
    return [
      {
        done: progress.hasStudents === true,
        title: 'Добавьте ученика',
        hint: 'и отправьте ему ссылку-приглашение',
        link: '/teacher/students',
        query: { create: 'student' },
      },
      {
        done: progress.priceSet === true,
        title: 'Укажите стоимость занятия',
        hint: 'проведённые занятия будут списываться с баланса ученика',
        link: '/teacher/billing',
      },
      {
        done: progress.messengerConfigured === true,
        title: 'Подключите мессенджер',
        hint: 'уведомления будут приходить вам и ученикам в Telegram, ВКонтакте или MAX',
        link: '/teacher/notifications',
        query: { tab: 'messengers' },
      },
      {
        done: progress.hasLessons === true,
        title: 'Запланируйте первое занятие',
        hint: 'разовое или регулярное — напоминания придут сами',
        link: '/teacher/schedule',
        query: { create: 'lesson' },
      },
    ];
  });
  protected readonly left = computed(() => this.steps().filter((step) => !step.done));
  protected readonly doneCount = computed(() => this.steps().length - this.left().length);
  protected readonly percent = computed(() =>
    Math.round((this.doneCount() / this.steps().length) * 100),
  );
  /** Shown once everything is known, until all steps are done or the teacher hides it. */
  protected readonly visible = computed(() => {
    const progress = this.progress();
    const known = Object.values(progress).every((value) => value !== null);
    return known && !this.dismissed() && this.doneCount() < this.steps().length;
  });

  dismiss(): void {
    hideHint(CHECKLIST_DISMISSED_KEY);
    this.dismissed.set(true);
  }
}
