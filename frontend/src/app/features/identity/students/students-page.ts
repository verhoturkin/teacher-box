import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { BillingApi } from '@features/billing/parts';
import { HelpButton } from '@features/help/parts';
import { NotificationsApi } from '@features/notifications/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectMobile } from '@core/layout/mobile';
import { openOnCreate } from '@core/routing/create-param';
import { pageDetail } from '@core/routing/page-detail';
import { readQuery, writeQuery } from '@core/routing/query-state';
import { Snackbar } from '@core/snackbar/snackbar';
import { labelKey } from '@core/theme/label-colors';
import { toIsoDate } from '@shared/dates/iso-date';
import { formatMoney } from '@shared/money/money';
import { Avatar } from '@shared/ui/avatar';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { Busy } from '@shared/ui/busy';
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { TeacherColors } from '../colors/teacher-colors';
import { IdentityApi } from '../data-access/identity-api';
import {
  CreatedStudent,
  IssuedInvite,
  Student,
  StudentGroup,
} from '../data-access/identity.models';
import { GroupCard } from '../groups/group-card';
import { GroupFormDialog } from '../groups/group-form-dialog';
import { T } from '../i18n/texts';
import { InviteLinkDialog } from './invite-link-dialog';
import {
  GroupRow,
  ROSTER_FILTERS,
  RosterFilter,
  RosterRow,
  StudentRow,
  countRows,
  filterRows,
  isOff,
  lessonWhen,
  rosterRows,
} from './roster';
import { cardTab, groupTab } from './card-tabs';
import { StudentCard, channelNames } from './student-card';
import { StudentFormDialog } from './student-form-dialog';
import { INVITE_PURPOSE_LABELS, STATUS_LABELS, STATUS_SEVERITIES } from './student-status';

/** How far ahead the list looks for the nearest lesson of each row. */
const LESSON_DAYS = 28;
const DAY_MS = 86_400_000;

/** What the list takes from the other features; `null` — that read failed, the list goes without it. */
interface Extras {
  readonly balances: ReadonlyMap<string, number> | null;
  readonly currency: string;
  readonly messengers: ReadonlySet<string> | null;
  /** The connected messengers by student (`ChannelType` names). */
  readonly channels: ReadonlyMap<string, readonly string[]> | null;
  readonly lessons: readonly ScheduledLesson[] | null;
}

function orNull<T>(source: Observable<T>): Observable<T | null> {
  return source.pipe(catchError(() => of(null)));
}

/**
 * Teacher: students and groups in one list-detail (redesign spec §8, `/teacher/students[/:studentId]`,
 * `/teacher/groups/:groupId`): the list with the search and the filter chips in the fixed pane, the card
 * of the chosen student or group beside it; on compact and medium the route shows one of them and the card
 * has «back» to the list.
 */
@Component({
  selector: 'tb-students-page',
  imports: [
    NgTemplateOutlet,
    SearchField,
    Avatar,
    EmptyState,
    FilterChips,
    HelpButton,
    ReactiveFormsModule,
    RouterLink,
    Button,
    Menu,
    Tag,
    Tooltip,
    ButtonAttributes,
    GroupCard,
    GroupFormDialog,
    InviteLinkDialog,
    StudentCard,
    StudentFormDialog,
    LoadStateView,
    PageHeader,
    Panes,
    Pane,
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.list">
          <div tbPaneHeader>
            <tb-page-header [title]="t.title">
              <tb-help-button help topic="teacher/students" />
              @if (state.ready()) {
                @if (!mobile()) {
                  <span meta class="tb-muted">{{ summary() }}</span>
                }
              }
              <!-- wider, the rail's «Создать» is the page's FAB (spec §1 principle 5) -->
              @if (mobile()) {
                <p-button
                  class="tb-page-fab"
                  [label]="t.add"
                  icon="tb-i tb-i-person_add"
                  (onClick)="openCreate()"
                />
              }
            </tb-page-header>

            <div class="tb-roster__filters">
              <tb-search-field [formControl]="search" [label]="t.search" />
              <tb-filter-chips
                [label]="t.filters"
                [chips]="chips()"
                [value]="filter()"
                (valueChange)="setFilter($event)"
              />
            </div>
          </div>
          <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
            @if (visibleRows().length > 0) {
              <ul class="tb-list tb-list--clamp" [attr.aria-label]="t.title">
                @for (row of visibleRows(); track row.kind + row.id) {
                  <li [class.tb-list__item--current]="isCurrent(row)">
                    @if (row.kind === 'student') {
                      <tb-avatar
                        [attr.data-tb-label]="colorOf(row)"
                        [name]="row.name"
                        [photo]="row.student.avatar"
                      />
                    } @else {
                      <span
                        class="tb-list__lead"
                        [attr.data-tb-label]="colorOf(row)"
                        aria-hidden="true"
                        ><i class="tb-i tb-i-group"></i
                      ></span>
                    }
                    <div class="tb-list__text">
                      <a
                        class="tb-list__title tb-list__link"
                        [routerLink]="linkOf(row)"
                        [attr.aria-current]="isCurrent(row) ? 'page' : null"
                        >{{ row.name }}</a
                      >
                      @if (supporting(row); as line) {
                        <span class="tb-list__supporting">{{ line }}</span>
                      }
                    </div>
                    <div class="tb-list__trail tb-list__trail--icons">
                      @if (row.kind === 'student') {
                        @if (debtOf(row); as debt) {
                          <span class="tb-roster__debt"
                            ><span aria-hidden="true">{{ debt.shown }}</span
                            ><span class="tb-sr-only">{{ debt.spoken }}</span></span
                          >
                        } @else if (row.student.status !== 'ACTIVE') {
                          <!-- one status on the right (spec §8): the debt, or else the tag -->
                          <p-tag
                            [value]="statusLabels[row.student.status]"
                            [severity]="statusSeverities[row.student.status]"
                            [pTooltip]="inviteHint(row.student)"
                          />
                        }
                      } @else if (row.group.archivedAt) {
                        <p-tag [value]="tg.archived" severity="secondary" />
                      }
                    </div>
                  </li>
                }
              </ul>
            } @else if (students().length === 0 && filter() !== 'groups') {
              <tb-empty-state icon="tb-i-person_add" [title]="t.emptyTitle" [hint]="t.emptyHint" />
            } @else if (filter() === 'groups' && groups().length === 0) {
              <tb-empty-state icon="tb-i-group" [title]="tg.emptyTitle" [hint]="tg.emptyHint" />
            } @else {
              <tb-empty-state
                icon="tb-i-search"
                [title]="t.notFoundTitle"
                [hint]="t.notFoundHint"
              />
            }
          </tb-load-state>
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane [label]="detailTitle()">
          <!-- «⋮» of the open card: in the page header on one pane, in the card's own header beside the list -->
          <ng-template #actions>
            @if (selected(); as row) {
              @if (row.kind === 'group') {
                <p-button
                  icon="tb-i tb-i-more_vert"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [pTooltip]="t.actions(row.name)"
                  [ariaLabel]="t.actions(row.name)"
                  [loading]="busy.is(row.id)"
                  [tbAttributes]="{
                    'aria-haspopup': 'menu',
                    'aria-expanded': menuFor() === row ? 'true' : 'false',
                  }"
                  (onClick)="openMenu(row, $event)"
                />
              }
            }
          </ng-template>
          @if (layout.single()) {
            <tb-page-header
              tbPaneHeader
              [title]="detailTitle()"
              back="/teacher/students"
              [backLabel]="t.all"
            >
              <ng-container [ngTemplateOutlet]="actions" />
            </tb-page-header>
          }
          @if (selected(); as row) {
            @if (row.kind === 'student') {
              <tb-student-card
                [student]="row"
                [currency]="extras().currency"
                [channels]="selectedChannels()"
                [tab]="cardTab()"
                [single]="layout.single()"
                [busy]="busy.is(row.id)"
                (changed)="loadExtras()"
                (saved)="onUpdated($event)"
                (invite)="reissueInvite(row.student)"
                (deactivate)="confirmDeactivate(row.student)"
                (reactivate)="reactivate(row.student)"
              />
            } @else {
              <tb-group-card
                [group]="row.group"
                [students]="students()"
                [tab]="groupCardTab()"
                [single]="layout.single()"
                [busy]="busy.is(row.id)"
                [menuOpen]="menuFor() === row"
                (more)="openMenu(row, $event)"
                (changed)="loadExtras()"
                (saved)="onGroupSaved($event)"
              />
            }
          } @else if (state.ready()) {
            @if (open()) {
              <tb-empty-state
                icon="tb-i-search"
                [title]="groupId() === undefined ? t.missingStudent : t.missingGroup"
                [hint]="t.missingHint"
              />
            } @else {
              <tb-empty-state icon="tb-i-group" [title]="t.pickTitle" [hint]="t.pickHint" />
            }
          }
        </tb-pane>
      }
    </tb-panes>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
    <tb-student-form-dialog
      [(visible)]="formVisible"
      (created)="onCreated($event)"
      (createGroup)="openCreateGroup()"
    />
    <tb-invite-link-dialog
      [(visible)]="inviteVisible"
      [invite]="invite()"
      [studentName]="inviteStudentName()"
    />
    <tb-group-form-dialog
      [(visible)]="groupFormVisible"
      [students]="students()"
      (created)="onGroupCreated($event)"
    />
  `,
  styles: `
    /* from expanded the pane does not scroll as a whole: its list does (our decision) */
    .tb-roster__filters {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-4);
    }

    .tb-roster__debt {
      color: var(--p-md-error);
      font: var(--tb-type-title-m);
      white-space: nowrap;
    }
  `,
})
export class StudentsPage implements OnInit {
  protected readonly mobile = injectMobile();
  protected readonly t = T.students;
  protected readonly tg = T.groups;
  protected readonly busy = new Busy();
  private readonly api = inject(IdentityApi);
  private readonly billing = inject(BillingApi);
  private readonly notifications = inject(NotificationsApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly colors = inject(TeacherColors);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly date = inject(DatePipe);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly menu = viewChild.required<Menu>('menu');

  /** Route parameter: the student whose card is open. */
  readonly studentId = input<string>();
  /** Route parameter: the group whose card is open. */
  readonly groupId = input<string>();
  /** Query parameter: the tab of the card (Обзор when missing). */
  readonly tab = input<string>();

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusSeverities = STATUS_SEVERITIES;

  protected readonly students = signal<Student[]>([]);
  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly extras = signal<Extras>({
    balances: null,
    currency: 'RUB',
    messengers: null,
    channels: null,
    lessons: null,
  });
  /** The moment the lessons were read: the nearest lesson is the nearest from it. */
  private readonly now = signal(Date.now());

  protected readonly state = new LoadState();
  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly filter = signal<RosterFilter>(
    readQuery(this.route, 'filter', ROSTER_FILTERS) ?? 'all',
  );

  protected readonly rows = computed(() => {
    const extras = this.extras();
    return rosterRows(
      {
        students: this.students(),
        groups: this.groups(),
        balances: extras.balances,
        messengers: extras.messengers,
        lessons: extras.lessons,
      },
      this.now(),
    );
  });
  protected readonly visibleRows = computed(() =>
    filterRows(this.rows(), this.filter(), this.query()),
  );
  protected readonly chips = computed<FilterChip<RosterFilter>[]>(() => {
    const rows = this.rows();
    const chips = this.t.chips;
    return [
      { value: 'all', label: chips.all },
      { value: 'groups', label: chips.groups },
      { value: 'debtors', label: chips.debtors, count: countRows(rows, 'debtors') },
      { value: 'noMessenger', label: chips.noMessenger, count: countRows(rows, 'noMessenger') },
      { value: 'deactivated', label: chips.deactivated },
    ];
  });
  /** «8 учеников · 2 группы»: the current ones. */
  protected readonly summary = computed(() => {
    const current = this.rows().filter((row) => !isOff(row));
    return this.t.summary(
      current.filter((row) => row.kind === 'student').length,
      current.filter((row) => row.kind === 'group').length,
    );
  });

  /** The route has a card: a student or a group. */
  protected readonly open = computed(
    () => this.studentId() !== undefined || this.groupId() !== undefined,
  );
  protected readonly layout = injectListDetail(() => this.open());
  /** The row of the open card; `null` — none, or not (yet) known. */
  protected readonly selected = computed<RosterRow | null>(() => {
    const studentId = this.studentId();
    const groupId = this.groupId();
    return (
      this.rows().find((row) =>
        row.kind === 'student' ? row.id === studentId : row.id === groupId,
      ) ?? null
    );
  });
  protected readonly cardTab = computed(() => cardTab(this.tab()));
  protected readonly groupCardTab = computed(() => groupTab(this.tab()));
  /** The messengers of the open student's card; a student missing from the read has none. */
  protected readonly selectedChannels = computed(() => {
    const row = this.selected();
    const channels = this.extras().channels;
    return row === null || channels === null ? null : channelNames(channels.get(row.id) ?? []);
  });
  protected readonly detailTitle = computed(() => this.selected()?.name ?? this.t.title);

  /** The row whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<RosterRow | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const row = this.menuFor();
    if (row === null) {
      return [];
    }
    return row.kind === 'group' ? this.groupActions(row.group) : [];
  });

  protected readonly formVisible = signal(false);
  protected readonly inviteVisible = signal(false);
  protected readonly invite = signal<IssuedInvite | null>(null);
  protected readonly inviteStudentName = signal('');
  protected readonly groupFormVisible = signal(false);

  constructor() {
    openOnCreate('student', () => {
      this.openCreate();
    });
    pageDetail(() => (this.open() ? this.selected()?.name : null));
  }

  ngOnInit(): void {
    this.load();
    this.loadExtras();
  }

  protected load(): void {
    forkJoin({
      students: this.api.listStudents(quietContext()),
      groups: this.api.listGroups(quietContext()),
    })
      .pipe(this.state.track())
      .subscribe(({ students, groups }) => {
        this.students.set(students);
        this.groups.set(groups);
      });
  }

  /** Balances, messengers and lessons: without them the rows only lose their supporting details. */
  protected loadExtras(): void {
    const today = new Date();
    forkJoin({
      overview: orNull(this.billing.overview(quietContext())),
      messengers: orNull(this.notifications.studentMessengers()),
      lessons: orNull(
        this.schedule.lessons(
          toIsoDate(today),
          toIsoDate(new Date(today.getTime() + LESSON_DAYS * DAY_MS)),
        ),
      ),
    }).subscribe(({ overview, messengers, lessons }) => {
      this.now.set(Date.now());
      this.extras.set({
        balances:
          overview === null
            ? null
            : new Map(overview.students.map((student) => [student.studentId, student.balance])),
        currency: overview?.currency ?? 'RUB',
        messengers:
          messengers === null
            ? null
            : new Set(
                messengers
                  .filter((student) => student.channels.length > 0)
                  .map((student) => student.studentId),
              ),
        channels:
          messengers === null
            ? null
            : new Map(
                messengers.map((student) => [
                  student.studentId,
                  student.channels.map((channel) => channel.channel),
                ]),
              ),
        lessons,
      });
    });
  }

  protected linkOf(row: RosterRow): string[] {
    return row.kind === 'student' ? ['/teacher/students', row.id] : ['/teacher/groups', row.id];
  }

  /** The row of the open card is marked beside it (from expanded). */
  protected isCurrent(row: RosterRow): boolean {
    return !this.layout.single() && this.selected() === row;
  }

  protected colorOf(row: RosterRow): string | null {
    const color = row.kind === 'student' ? row.student.color : row.group.color;
    return color === null ? null : labelKey(color);
  }

  /** «вт 17:00 · аванс 1 500 ₽»; a group — «2 участника · пн 16:00». */
  protected supporting(row: RosterRow): string {
    return (row.kind === 'student' ? this.studentLine(row) : this.groupLine(row)).join(' · ');
  }

  private studentLine(row: StudentRow): string[] {
    if (isOff(row)) {
      return [];
    }
    const parts = [this.nextLine(row.next)].filter((part) => part !== null);
    if (row.balance !== null && row.balance > 0) {
      parts.push(this.t.prepaid(this.money(row.balance)));
    }
    return parts;
  }

  private groupLine(row: GroupRow): string[] {
    // the count, not the names: a big group keeps one row high (the names are on «Участники»)
    const count = row.group.members.length;
    const parts = [count === 0 ? this.tg.nobody : T.groupCard.members(count)];
    const next = isOff(row) ? null : this.nextLine(row.next);
    return next === null ? parts : [...parts, next];
  }

  /** The nearest lesson, «нет занятий», or nothing when the lessons are not known. */
  private nextLine(next: string | null): string | null {
    if (next !== null) {
      return lessonWhen(next, this.now(), this.t);
    }
    return this.extras().lessons === null ? null : this.t.noLessons;
  }

  protected debtOf(row: StudentRow): { shown: string; spoken: string } | null {
    if (row.balance === null || row.balance >= 0) {
      return null;
    }
    return { shown: this.money(row.balance), spoken: this.t.debt(this.money(-row.balance)) };
  }

  private money(amount: number): string {
    return formatMoney(amount, this.extras().currency);
  }

  /** The tooltip of the status: until when the issued link works. */
  protected inviteHint(student: Student): string {
    const invite = student.pendingInvite;
    if (invite === null) {
      return '';
    }
    const until = this.date.transform(invite.expiresAt, 'dd.MM.yyyy') ?? '';
    return this.t.inviteUntil(INVITE_PURPOSE_LABELS[invite.purpose], until);
  }

  protected openMenu(row: RosterRow, event: Event): void {
    this.menuFor.set(row);
    this.menu().toggle(event);
  }

  protected openCreate(): void {
    this.formVisible.set(true);
  }

  protected openCreateGroup(): void {
    this.groupFormVisible.set(true);
  }

  /** A new student: their card opens on Профиль to fill in the rest, over it the invitation link. */
  protected onCreated(created: CreatedStudent): void {
    this.students.update((students) => [...students, created.student]);
    this.colors.rememberStudent(created.student);
    void this.router.navigate(['/teacher/students', created.student.id], {
      queryParams: { tab: 'profile' },
    });
    this.showInvite(created.student, created.invite);
  }

  /** The chip is kept in the address (`?filter=`), so «Назад» from a card and a reload bring it back. */
  protected setFilter(filter: RosterFilter): void {
    this.filter.set(filter);
    writeQuery(this.router, this.route, { filter: filter === 'all' ? null : filter });
  }

  protected onUpdated(student: Student): void {
    this.replaceStudent(student);
    this.colors.rememberStudent(student);
    this.snackbar.success(this.t.saved(student.displayName));
  }

  /** A new group: its card opens on Профиль to set the price and the rest. */
  protected onGroupCreated(group: StudentGroup): void {
    this.groups.update((groups) => [...groups, group]);
    this.colors.rememberGroup(group);
    this.snackbar.success(this.tg.saved);
    void this.router.navigate(['/teacher/groups', group.id], { queryParams: { tab: 'profile' } });
  }

  /** The card saved the members or the profile of the group. */
  protected onGroupSaved(group: StudentGroup): void {
    this.replaceGroup(group);
    this.colors.rememberGroup(group);
  }

  protected reissueInvite(student: Student): void {
    this.busy.guard(student.id, this.api.reissueInvite(student.id)).subscribe((invite) => {
      this.replaceStudent({
        ...student,
        pendingInvite: { purpose: invite.purpose, expiresAt: invite.expiresAt },
      });
      this.showInvite(student, invite);
    });
  }

  protected async confirmDeactivate(student: Student): Promise<void> {
    if (
      await this.confirm.danger({
        header: this.t.deactivateHeader,
        message: this.t.deactivateMessage(student.displayName),
        icon: 'tb-i tb-i-warning',
        acceptLabel: this.t.deactivate,
      })
    ) {
      this.api.deactivate(student.id).subscribe((saved) => {
        this.replaceStudent(saved);
      });
    }
  }

  protected reactivate(student: Student): void {
    this.busy.guard(student.id, this.api.reactivate(student.id)).subscribe((saved) => {
      this.replaceStudent(saved);
    });
  }

  private async confirmArchive(group: StudentGroup): Promise<void> {
    if (
      await this.confirm.danger({
        header: this.tg.archiveHeader,
        message: this.tg.archiveMessage(group.name),
        icon: 'tb-i tb-i-warning',
        acceptLabel: this.tg.archive,
      })
    ) {
      this.api.archiveGroup(group.id).subscribe((saved) => {
        this.replaceGroup(saved);
      });
    }
  }

  private restore(group: StudentGroup): void {
    this.busy.guard(group.id, this.api.restoreGroup(group.id)).subscribe((saved) => {
      this.replaceGroup(saved);
    });
  }

  private groupActions(group: StudentGroup): MenuItem[] {
    return [
      group.archivedAt === null
        ? {
            label: this.tg.archiveItem,
            icon: 'tb-i tb-i-inbox',
            styleClass: 'tb-menu-item--danger',
            command: () => {
              void this.confirmArchive(group);
            },
          }
        : {
            label: this.tg.restore,
            icon: 'tb-i tb-i-replay',
            command: () => {
              this.restore(group);
            },
          },
    ];
  }

  private showInvite(student: Student, invite: IssuedInvite): void {
    this.inviteStudentName.set(student.displayName);
    this.invite.set(invite);
    this.inviteVisible.set(true);
  }

  private replaceStudent(saved: Student): void {
    this.students.update((students) =>
      students.map((student) => (student.id === saved.id ? saved : student)),
    );
  }

  private replaceGroup(saved: StudentGroup): void {
    this.groups.update((groups) => groups.map((group) => (group.id === saved.id ? saved : group)));
  }
}
