import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { PaymentDialog, StudentBalanceCard } from '@features/billing/parts';
import { StudentTasksCard } from '@features/homework/parts';
import { RoomLink } from '@features/meetings/parts';
import { BroadcastDialog, StudentChannels } from '@features/notifications/parts';
import { LessonDialog, ScheduleApi, StudentLessonsCard } from '@features/schedule/parts';
import { injectMobile } from '@core/layout/mobile';
import { Snackbar } from '@core/snackbar/snackbar';
import { labelKey } from '@core/theme/label-colors';
import { SHARED_T } from '@shared/i18n/texts';
import { formatMoney } from '@shared/money/money';
import { Avatar } from '@shared/ui/avatar';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { T } from '../i18n/texts';
import { CARD_TABS, CardTab, DEFAULT_TAB, cardTab } from './card-tabs';
import { StudentRow } from './roster';
import { STATUS_LABELS, STATUS_SEVERITIES } from './student-status';

/** A tag of the header: the status, the messenger, the balance. */
interface HeaderTag {
  readonly value: string;
  readonly severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null;
  readonly icon?: string;
}

/**
 * The card of a student (redesign spec §8): the header — the 72 px avatar, the name, «с сентября 2025», the
 * tags of the status, the messenger and the balance, the actions «Написать», «Оплата», «Занятие» and «⋮» — and
 * the tabs named by `?tab=`. Обзор puts together the parts of the other features: the next lessons, the open
 * homework, the balance, the messengers and the video meeting.
 */
@Component({
  selector: 'tb-student-card',
  imports: [
    Avatar,
    BroadcastDialog,
    Button,
    ButtonAttributes,
    Card,
    LessonDialog,
    PaymentDialog,
    RoomLink,
    StudentBalanceCard,
    StudentChannels,
    StudentLessonsCard,
    StudentTasksCard,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Tag,
    Tooltip,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let row = student();
    <header class="tb-student-card__head">
      <tb-avatar
        class="tb-student-card__avatar"
        [attr.data-tb-label]="color()"
        [name]="row.name"
        [photo]="row.student.avatar"
        size="4.5rem"
      />
      <div class="tb-student-card__text">
        @if (!single()) {
          <h2 class="tb-student-card__name">{{ row.name }}</h2>
        }
        <span class="tb-student-card__since">{{ since() }}</span>
        @if (tags().length > 0) {
          <div class="tb-student-card__tags">
            @for (tag of tags(); track tag.value) {
              <p-tag [value]="tag.value" [severity]="tag.severity" [icon]="tag.icon ?? ''" />
            }
          </div>
        }
      </div>
      <div class="tb-student-card__actions">
        @if (current()) {
          <p-button
            [label]="t.write"
            icon="tb-i tb-i-chat"
            severity="secondary"
            (onClick)="writeVisible.set(true)"
          />
        }
        <p-button
          [label]="t.payment"
          icon="tb-i tb-i-payments"
          severity="secondary"
          [pTooltip]="t.paymentHint"
          (onClick)="paymentVisible.set(true)"
        />
        @if (current()) {
          <p-button
            [label]="t.lesson"
            icon="tb-i tb-i-event"
            [severity]="mobile() ? 'secondary' : 'primary'"
            [loading]="lessonPending()"
            (onClick)="openLesson()"
          />
        }
        @if (!single()) {
          <p-button
            class="tb-student-card__more"
            icon="tb-i tb-i-more_vert"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [pTooltip]="actionsLabel()"
            [ariaLabel]="actionsLabel()"
            [loading]="busy()"
            [tbAttributes]="{
              'aria-haspopup': 'menu',
              'aria-expanded': menuOpen() ? 'true' : 'false',
            }"
            (onClick)="more.emit($event)"
          />
        }
      </div>
    </header>

    <p-tabs
      class="tb-tabs tb-tabs--start"
      [value]="tab()"
      [scrollable]="true"
      (valueChange)="choose($event)"
    >
      <p-tablist>
        @for (item of tabs; track item) {
          <p-tab [value]="item">{{ t.tabNames[item] }}</p-tab>
        }
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="overview">
          @if (tab() === 'overview') {
            <div class="tb-student-card__overview">
              <tb-student-lessons-card [studentId]="row.id" [revision]="revision()" />
              <tb-student-tasks-card [studentId]="row.id" />
              <tb-student-balance-card [studentId]="row.id" [revision]="revision()" />
              <p-card [header]="t.connection">
                <tb-student-channels [studentId]="row.id" />
                <tb-room-link [owner]="roomOwner()" />
              </p-card>
            </div>
          }
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    <tb-broadcast-dialog [(visible)]="writeVisible" [to]="recipient()" (sent)="onSent()" />
    <tb-payment-dialog
      [(visible)]="paymentVisible"
      [students]="payer()"
      [studentId]="row.id"
      [currency]="currency()"
      (saved)="onPaid()"
    />
    <tb-lesson-dialog
      [(visible)]="lessonVisible"
      [students]="lessonStudents()"
      [studentId]="row.id"
      [defaultDuration]="duration() ?? 60"
      (saved)="onPlanned()"
    />
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-student-card__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-4);
      margin-block-end: var(--tb-space-4);
    }

    /* the avatar in the student's colour (our decision; the rows tint their tile instead) */
    .tb-student-card__avatar[data-tb-label] {
      background: var(--tb-label-container);
      color: var(--tb-on-label-container);
    }

    .tb-student-card__text {
      display: flex;
      flex: 1 1 12rem;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;
    }

    .tb-student-card__name {
      margin: 0;
      font: var(--tb-type-headline-s);
      overflow-wrap: anywhere;
    }

    .tb-student-card__since {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-student-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      margin-block-start: var(--tb-space-1);
    }

    .tb-student-card__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    /* compact: the actions under the name, equal width across the card (spec §8) */
    @media (width < 37.5em) {
      .tb-student-card__actions {
        display: grid;
        flex-basis: 100%;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;

        ::ng-deep .p-button {
          width: 100%;
        }
      }
    }

    .tb-student-card__overview {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }
  `,
})
export class StudentCard {
  protected readonly t = T.card;
  protected readonly tabs = CARD_TABS;
  protected readonly mobile = injectMobile();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly schedule = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  private readonly date = inject(DatePipe);

  readonly student = input.required<StudentRow>();
  readonly currency = input.required<string>();
  /** Names of the messengers the student connected; `null` — not known. */
  readonly channels = input<readonly string[] | null>(null);
  readonly tab = input<CardTab>(DEFAULT_TAB);
  /** One pane (compact, medium): the page header carries the name and «⋮». */
  readonly single = input(false);
  /** An action of «⋮» is running. */
  readonly busy = input(false);
  readonly menuOpen = input(false);
  /** «⋮»: the page opens its menu. */
  readonly more = output<Event>();
  /** A payment or a lesson changed what the list knows of the student. */
  readonly changed = output();

  protected readonly writeVisible = signal(false);
  protected readonly paymentVisible = signal(false);
  protected readonly lessonVisible = signal(false);
  protected readonly lessonPending = signal(false);
  /** The length of a new lesson from the schedule settings; read when first needed. */
  protected readonly duration = signal<number | null>(null);
  /** Bumped by a payment or a lesson: the cards of Обзор read again. */
  protected readonly revision = signal(0);

  /** Not deactivated: the student can be written to and taught. */
  protected readonly current = computed(() => this.student().student.status !== 'DEACTIVATED');
  protected readonly color = computed(() => {
    const color = this.student().student.color;
    return color === null ? null : labelKey(color);
  });
  protected readonly actionsLabel = computed(() => T.students.actions(this.student().name));
  protected readonly since = computed(() =>
    this.t.since(this.date.transform(this.student().student.createdAt, 'MMMM yyyy') ?? ''),
  );
  protected readonly tags = computed<HeaderTag[]>(() => {
    const row = this.student();
    const tags: HeaderTag[] = [];
    if (row.student.status !== 'ACTIVE') {
      tags.push({
        value: STATUS_LABELS[row.student.status],
        severity: STATUS_SEVERITIES[row.student.status],
      });
    }
    const channels = this.channels();
    if (channels !== null && row.student.status !== 'DEACTIVATED') {
      tags.push(
        channels.length === 0
          ? { value: this.t.noMessenger, severity: 'warn' }
          : { value: channels.join(', '), severity: 'secondary', icon: 'tb-i tb-i-send' },
      );
    }
    if (row.balance !== null && row.balance !== 0) {
      const amount = formatMoney(Math.abs(row.balance), this.currency());
      tags.push(
        row.balance < 0
          ? { value: this.t.debt(amount), severity: 'danger' }
          : { value: this.t.prepaid(amount), severity: 'success' },
      );
    }
    return tags;
  });

  protected readonly recipient = computed(() => ({
    id: this.student().id,
    displayName: this.student().name,
  }));
  protected readonly payer = computed(() => [
    { studentId: this.student().id, displayName: this.student().name, lessonPrice: 0 },
  ]);
  protected readonly lessonStudents = computed(() => [
    {
      id: this.student().id,
      displayName: this.student().name,
      defaultTopic: this.student().student.defaultTopic,
    },
  ]);
  protected readonly roomOwner = computed(() => ({
    type: 'STUDENT' as const,
    id: this.student().id,
    name: this.student().name,
  }));

  /** A tab chosen: `?tab=` names it, Обзор (the first) leaves the address without it. */
  protected choose(value: string | number | undefined): void {
    const tab = cardTab(String(value));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: CARD_TABS.indexOf(tab) === 0 ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** «Занятие»: the dialog opens once the length of a new lesson is known (60 min if it cannot be read). */
  protected openLesson(): void {
    if (this.duration() !== null) {
      this.lessonVisible.set(true);
      return;
    }
    this.lessonPending.set(true);
    this.schedule
      .settings()
      .pipe(catchError(() => of(null)))
      .subscribe((settings) => {
        this.lessonPending.set(false);
        this.duration.set(settings?.defaultDurationMinutes ?? 60);
        this.lessonVisible.set(true);
      });
  }

  protected onSent(): void {
    this.snackbar.success(this.t.sent);
  }

  protected onPaid(): void {
    this.snackbar.success(this.t.paid);
    this.refresh();
  }

  protected onPlanned(): void {
    this.snackbar.success(this.t.planned);
    this.refresh();
  }

  private refresh(): void {
    this.revision.update((revision) => revision + 1);
    this.changed.emit();
  }
}

/** The names of the connected messengers, as the header shows them. */
export function channelNames(channels: readonly string[]): string[] {
  const names: Readonly<Record<string, string>> = SHARED_T.messengers;
  return channels.map((channel) => names[channel] ?? channel);
}
