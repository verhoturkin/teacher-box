import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';

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

function readDismissed(): boolean {
  try {
    return localStorage.getItem(CHECKLIST_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, '1');
  } catch {
    // Storage is unavailable: the checklist shows up again next time.
  }
}

/** Teacher's home: the first steps after installation, until they are done or hidden. */
@Component({
  selector: 'tb-first-run-checklist',
  imports: [RouterLink, Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <p-card header="С чего начать">
        <ol class="tb-checklist">
          @for (step of steps(); track step.title) {
            <li [class.tb-checklist__done]="step.done">
              <i [class]="step.done ? 'pi pi-check-circle' : 'pi pi-circle'" aria-hidden="true"></i>
              <div>
                @if (step.done) {
                  <span>{{ step.title }}</span>
                } @else {
                  <a [routerLink]="step.link" [queryParams]="step.query" class="tb-link">{{ step.title }}</a>
                }
                <small class="tb-muted">{{ step.hint }}</small>
              </div>
            </li>
          }
        </ol>
        <div class="tb-widget-footer">
          <span class="tb-muted">Сделано {{ doneCount() }} из {{ steps().length }}</span>
          <p-button label="Скрыть" severity="secondary" size="small" [text]="true" (onClick)="dismiss()" />
        </div>
      </p-card>
    }
  `,
  styles: `
    .tb-checklist {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;

        > i {
          margin-top: 0.2rem;
          color: var(--p-text-muted-color);
        }

        div {
          display: flex;
          flex-direction: column;
        }

        &.tb-checklist__done {
          > i {
            color: var(--p-green-500);
          }

          span {
            text-decoration: line-through;
            color: var(--p-text-muted-color);
          }
        }
      }
    }
  `,
})
export class FirstRunChecklist {
  readonly progress = input.required<SetupProgress>();

  private readonly dismissed = signal(readDismissed());

  protected readonly steps = computed<Step[]>(() => {
    const progress = this.progress();
    return [
      {
        done: progress.hasStudents === true,
        title: 'Добавьте ученика',
        hint: 'и отправьте ему ссылку-приглашение',
        link: '/teacher/students',
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
      },
    ];
  });
  protected readonly doneCount = computed(() => this.steps().filter((step) => step.done).length);
  /** Shown once everything is known, until all steps are done or the teacher hides it. */
  protected readonly visible = computed(() => {
    const progress = this.progress();
    const known = Object.values(progress).every((value) => value !== null);
    return known && !this.dismissed() && this.doneCount() < this.steps().length;
  });

  dismiss(): void {
    writeDismissed();
    this.dismissed.set(true);
  }
}
