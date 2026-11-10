import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { locale } from '@core/i18n/language';
import { DEFAULT_PORTAL_NAME, Portal } from '@core/portal/portal';
import { T } from '@features/settings/i18n/texts';
import { spanLabel, zoneLabel } from '@features/settings/lesson-options';
import { formatMoney } from '@shared/money/money';
import { Saved, StepId, nonEmpty } from './setup-state';

const t = T.setup;

/** The next steps of «Готово». */
export type NextCardId = 'student' | 'messenger' | 'ai' | 'google';

/** The state of a next step once known: done or what is left. */
export type NextStates = Partial<Record<NextCardId, { state: string; done: boolean }>>;

/** Where a card of «Готово» leads. */
export interface NextLink {
  readonly link: string;
  readonly query?: Readonly<Record<string, string>>;
}

/** A card of «Готово»: where it leads and its state once known. */
interface NextCard extends NextLink {
  readonly id: NextCardId;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly state: string | null;
  readonly done: boolean;
}

/** A row of «Что вы настроили» and the step that changes it. */
interface SummaryRow {
  readonly label: string;
  readonly value: string;
  readonly step: StepId;
}

/** «Готово»: the next steps as cards (sketch OnbDone); each finishes the setup and opens its page. */
@Component({
  selector: 'tb-setup-done-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ul class="tb-setup__next" [attr.aria-label]="t.nextSteps">
      @for (card of cards(); track card.id; let first = $first) {
        <li>
          <button
            type="button"
            class="tb-setup__card"
            [class.tb-setup__card--hero]="first"
            [disabled]="pending()"
            (click)="opened.emit({ link: card.link, query: card.query })"
          >
            <span class="tb-setup__card-icon" aria-hidden="true"
              ><i class="tb-i" [class]="card.icon"></i
            ></span>
            <b>{{ card.title }}</b>
            <span class="tb-setup__card-text">{{ card.text }}</span>
            @if (card.state !== null) {
              <span class="tb-setup__card-state" [class.tb-positive]="card.done">
                @if (card.done) {
                  <i class="tb-i tb-i-check_circle" aria-hidden="true"></i>
                }
                {{ card.state }}
              </span>
            }
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    /* «Готово»: the next steps as cards, two columns (sketch OnbDone) */
    .tb-setup__next {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-setup__card {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      width: 100%;
      height: 100%;
      padding: var(--tb-space-5);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface-container-lowest);
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--p-md-surface-container-lowest)
        );
      }

      b {
        font: var(--tb-type-title-m);
      }
    }

    .tb-setup__card--hero {
      border-color: var(--p-md-secondary-container);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-setup__card-icon {
        background: var(--p-md-primary);
        color: var(--p-md-on-primary);
      }
    }

    .tb-setup__card-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-low);
      color: var(--p-md-primary);
    }

    .tb-setup__card-text {
      font: var(--tb-type-body-m);
    }

    .tb-setup__card-state {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin-block-start: auto;
      font: var(--tb-type-label-l);

      .tb-i {
        font-size: 1.125rem;
      }
    }
  `,
})
export class SetupDoneStep {
  protected readonly t = t;
  /** The states of the next steps, as far as they are known. */
  readonly states = input.required<NextStates>();
  /** Finishing is under way: the cards wait. */
  readonly pending = input.required<boolean>();
  /** A card was chosen: the setup finishes and opens its page. */
  readonly opened = output<NextLink>();

  protected readonly cards = computed<NextCard[]>(() => {
    const states = this.states();
    const card = (id: NextCardId, rest: Omit<NextCard, 'id' | 'state' | 'done'>): NextCard => ({
      id,
      ...rest,
      state: states[id]?.state ?? null,
      done: states[id]?.done ?? false,
    });
    return [
      card('student', {
        icon: 'tb-i-person_add',
        title: t.addStudent,
        text: t.addStudentText,
        link: '/teacher/students',
        query: { create: 'student' },
      }),
      card('messenger', {
        icon: 'tb-i-forum',
        title: t.connectMessenger,
        text: t.connectMessengerText,
        link: '/teacher/settings/messengers',
      }),
      card('ai', {
        icon: 'tb-i-auto_awesome',
        title: t.connectAi,
        text: t.connectAiText,
        link: '/teacher/settings/ai',
      }),
      card('google', {
        icon: 'tb-i-event',
        title: t.google,
        text: t.googleText,
        link: '/teacher/settings/lessons',
      }),
    ];
  });
}

/** «Что вы настроили»: the values as saved (a skipped step shows the server's), each with «Изменить». */
@Component({
  selector: 'tb-setup-done-preview',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ul class="tb-tiles tb-setup__summary">
      @for (row of summary(); track row.label) {
        <li class="tb-tile">
          <span class="tb-tile__text">
            <span>{{ row.label }}</span>
            <b>{{ row.value }}</b>
          </span>
          <p-button
            icon="tb-i tb-i-edit"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="t.edit(row.label)"
            (onClick)="edit.emit(row.step)"
          />
        </li>
      }
    </ul>
    <small class="tb-hint">{{ t.changeLater }}</small>
  `,
  styles: `
    .tb-setup__summary {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class SetupDonePreview {
  protected readonly t = t;
  private readonly portal = inject(Portal);
  readonly saved = input.required<Saved | null>();
  /** «Изменить»: the step that changes the row. */
  readonly edit = output<StepId>();

  protected readonly summary = computed<SummaryRow[]>(() => {
    const saved = this.saved();
    if (saved === null) {
      return [];
    }
    const { portal, rules } = saved;
    const host = (portal.address ?? this.portal.openedAt()).replace(/^https?:\/\//, '');
    const length = spanLabel(rules.defaultDurationMinutes);
    const reminders = [...rules.reminderMinutes]
      .sort((a, b) => b - a)
      .map((minutes) => T.page.before(spanLabel(minutes)).toLocaleLowerCase(locale()));
    return [
      {
        label: t.summaryPortal,
        value: `${nonEmpty(portal.name) ?? DEFAULT_PORTAL_NAME} · ${host}`,
        step: 'portal',
      },
      { label: t.summaryZone, value: zoneLabel(saved.zone), step: 'time' },
      {
        label: t.summaryLesson,
        value: saved.price > 0 ? `${length} · ${formatMoney(saved.price, saved.currency)}` : length,
        step: 'time',
      },
      {
        label: t.summaryLate,
        value:
          rules.lateCancellationMinutes > 0
            ? t.lessThan(spanLabel(rules.lateCancellationMinutes))
            : t.off,
        step: 'rules',
      },
      {
        label: t.summaryReminders,
        value:
          reminders.length > 0
            ? `${reminders.slice(0, -1).join(', ')}${reminders.length > 1 ? t.and : ''}${reminders.at(-1) ?? ''}`
            : t.off,
        step: 'rules',
      },
      { label: t.summaryDueSoon, value: t.remindBefore(spanLabel(saved.dueSoon)), step: 'rules' },
    ];
  });
}
