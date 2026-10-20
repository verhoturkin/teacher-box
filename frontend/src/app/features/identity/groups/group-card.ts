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
import { Tooltip } from 'primeng/tooltip';
import { StudentTasksTab } from '@features/homework/parts';
import { RoomLink } from '@features/meetings/parts';
import { BroadcastDialog } from '@features/notifications/parts';
import {
  LessonDialog,
  ScheduleApi,
  StudentLessonsCard,
  StudentLessonsTab,
} from '@features/schedule/parts';
import { injectMobile } from '@core/layout/mobile';
import { Snackbar } from '@core/snackbar/snackbar';
import { labelKey } from '@core/theme/label-colors';
import { Student, StudentGroup } from '../data-access/identity.models';
import { T } from '../i18n/texts';
import { CardHead, HeaderTag } from '../students/card-head';
import { DEFAULT_TAB, GROUP_TABS, GroupTab, groupTab, showTab } from '../students/card-tabs';
import { GroupMembersTab } from './group-members-tab';
import { GroupProfileTab } from './group-profile-tab';

/**
 * The card of a group (redesign spec §8), built as a student's: the same header — the 72 px tile in the
 * group's colour, the name, «3 участника · с сентября 2025», the archive tag, «Написать» (every current
 * member), «Занятие» (with the group) and «⋮» — and the tabs Обзор (the next lessons, the video meeting),
 * Занятия, Задания (the tasks of every member), Участники and Профиль.
 */
@Component({
  selector: 'tb-group-card',
  imports: [
    BroadcastDialog,
    Button,
    Card,
    CardHead,
    GroupMembersTab,
    GroupProfileTab,
    LessonDialog,
    RoomLink,
    StudentLessonsCard,
    StudentLessonsTab,
    StudentTasksTab,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Tooltip,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = group();
    <tb-card-head
      [name]="item.name"
      [line]="line()"
      [tags]="tags()"
      [single]="single()"
      [actionsLabel]="actionsLabel()"
      [busy]="busy()"
      [menuOpen]="menuOpen()"
      (more)="more.emit($event)"
    >
      <span avatar class="tb-group-card__avatar" [attr.data-tb-label]="color()" aria-hidden="true"
        ><i class="tb-i tb-i-group"></i
      ></span>
      @if (current() && recipients().length > 0) {
        <p-button
          [label]="c.write"
          icon="tb-i tb-i-chat"
          severity="secondary"
          [pTooltip]="t.writeHint"
          (onClick)="writeVisible.set(true)"
        />
      }
      @if (current()) {
        <p-button
          [label]="c.lesson"
          icon="tb-i tb-i-event"
          [severity]="mobile() ? 'secondary' : 'primary'"
          [pTooltip]="t.lessonHint"
          [loading]="lessonPending()"
          (onClick)="openLesson()"
        />
      }
    </tb-card-head>

    <p-tabs
      class="tb-tabs tb-tabs--start"
      [value]="tab()"
      [scrollable]="true"
      (valueChange)="choose($event)"
    >
      <p-tablist>
        @for (name of tabs; track name) {
          <p-tab [value]="name">{{ c.tabNames[name] }}</p-tab>
        }
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="overview">
          @if (tab() === 'overview') {
            <div class="tb-group-card__overview">
              <tb-student-lessons-card [of]="lessonsOf()" [revision]="revision()" />
              @if (roomOwner(); as owner) {
                <p-card [header]="c.connection">
                  <tb-room-link [owner]="owner" />
                </p-card>
              }
            </div>
          }
        </p-tabpanel>
        <p-tabpanel value="lessons">
          @if (tab() === 'lessons') {
            <tb-student-lessons-tab [of]="lessonsOf()" [revision]="revision()" />
          }
        </p-tabpanel>
        <p-tabpanel value="homework">
          @if (tab() === 'homework') {
            <tb-student-tasks-tab [members]="item.members" />
          }
        </p-tabpanel>
        <p-tabpanel value="members">
          @if (tab() === 'members') {
            <tb-group-members-tab
              [group]="item"
              [students]="students()"
              (saved)="saved.emit($event)"
            />
          }
        </p-tabpanel>
        <p-tabpanel value="profile">
          @if (tab() === 'profile') {
            <tb-group-profile-tab [group]="item" (saved)="saved.emit($event)" />
          }
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>

    <tb-broadcast-dialog
      [(visible)]="writeVisible"
      [toGroup]="recipientGroup()"
      (sent)="onSent()"
    />
    <tb-lesson-dialog
      [(visible)]="lessonVisible"
      [students]="[]"
      [groups]="lessonGroups()"
      [groupId]="item.id"
      [defaultDuration]="duration() ?? 60"
      (saved)="onPlanned()"
    />
  `,
  styles: `
    :host {
      display: block;
    }

    /* the 72 px tile of the student's avatar, with the group icon (our decision) */
    .tb-group-card__avatar {
      display: inline-grid;
      flex: none;
      place-items: center;
      inline-size: 4.5rem;
      block-size: 4.5rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font-size: 2.25rem;
    }

    .tb-group-card__avatar[data-tb-label] {
      background: var(--tb-label-container);
      color: var(--tb-on-label-container);
    }

    .tb-group-card__overview {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }
  `,
})
export class GroupCard {
  protected readonly c = T.card;
  protected readonly t = T.groupCard;
  protected readonly tabs = GROUP_TABS;
  protected readonly mobile = injectMobile();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly schedule = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  private readonly date = inject(DatePipe);

  readonly group = input.required<StudentGroup>();
  /** Every student of the teacher: the ones the Участники tab can add. */
  readonly students = input<readonly Student[]>([]);
  readonly tab = input<GroupTab>(DEFAULT_TAB);
  /** One pane (compact, medium): the page header carries the name and «⋮». */
  readonly single = input(false);
  /** An action of «⋮» is running. */
  readonly busy = input(false);
  readonly menuOpen = input(false);
  /** «⋮»: the page opens its menu. */
  readonly more = output<Event>();
  /** A lesson was planned: the list reads the nearest lessons again. */
  readonly changed = output();
  /** The members or the profile were saved. */
  readonly saved = output<StudentGroup>();

  protected readonly writeVisible = signal(false);
  protected readonly lessonVisible = signal(false);
  protected readonly lessonPending = signal(false);
  /** The length of a new lesson from the schedule settings; read when first needed. */
  protected readonly duration = signal<number | null>(null);
  /** Bumped by a planned lesson: the lessons read again. */
  protected readonly revision = signal(0);

  /** Not archived: the group can be written to and taught. */
  protected readonly current = computed(() => this.group().archivedAt === null);
  protected readonly color = computed(() => {
    const color = this.group().color;
    return color === null ? null : labelKey(color);
  });
  protected readonly actionsLabel = computed(() => T.groups.actions(this.group().name));
  /** «3 участника · с сентября 2025». */
  protected readonly line = computed(() => {
    const group = this.group();
    const count = group.members.length;
    return [
      count === 0 ? this.t.nobody : this.t.members(count),
      this.c.since(this.date.transform(group.createdAt, 'MMMM yyyy') ?? ''),
    ].join(' · ');
  });
  protected readonly tags = computed<HeaderTag[]>(() =>
    this.current() ? [] : [{ value: T.groups.archived, severity: 'secondary' }],
  );
  /** The members who can get a message. */
  protected readonly recipients = computed(() =>
    this.group().members.filter((member) => member.status !== 'DEACTIVATED'),
  );
  protected readonly recipientGroup = computed(() => ({
    name: this.group().name,
    members: this.recipients(),
  }));
  protected readonly lessonGroups = computed(() => [
    { id: this.group().id, name: this.group().name, defaultTopic: this.group().defaultTopic },
  ]);
  protected readonly lessonsOf = computed(() => ({ groupId: this.group().id }), {
    equal: (a, b) => a.groupId === b.groupId,
  });
  protected readonly roomOwner = computed(() => {
    const group = this.group();
    return this.current() ? { type: 'GROUP' as const, id: group.id, name: group.name } : null;
  });

  protected choose(value: string | number | undefined): void {
    showTab(this.router, this.route, groupTab(String(value)));
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
    this.snackbar.success(this.c.sent);
  }

  protected onPlanned(): void {
    this.snackbar.success(this.c.planned);
    this.revision.update((revision) => revision + 1);
    this.changed.emit();
  }
}
