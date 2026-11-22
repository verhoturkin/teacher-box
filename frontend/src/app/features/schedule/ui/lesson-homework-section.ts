import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { toIsoDate } from '@shared/dates/iso-date';
import { AssignmentSummary, HomeworkApi, assignmentProgress } from '@features/homework/parts';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/** How many days back the picker offers the participants' assignments, and how far the links are looked up. */
const RECENT_DAYS = 30;
const LINKS_DAYS = 90;

/** A linked assignment as the section shows it; `summary` is `null` for a deleted one. */
interface LinkedRow {
  readonly id: string;
  readonly summary: AssignmentSummary | null;
}

/** A choice of «Привязать»: a recent assignment of the participants or a bank item. */
interface HomeworkChoice {
  readonly key: string;
  readonly id: string;
  readonly bank: boolean;
  readonly title: string;
}

interface ChoiceGroup {
  readonly label: string;
  readonly items: readonly HomeworkChoice[];
}

/** The students of the lesson: the student of an individual lesson, the participants of a group one. */
export function lessonStudents(lesson: ScheduledLesson): string[] {
  if (lesson.groupId === null) {
    return lesson.studentId === null ? [] : [lesson.studentId];
  }
  return lesson.participants.map((participant) => participant.studentId);
}

/**
 * Teacher: «Домашнее задание» of the lesson card (roadmap 11 «Lesson card», 462.2). The linked assignments with
 * their status (a row opens the assignment, a draft — its editor; «⋮» «Отвязать» takes it off, the assignment
 * stays). «Задать» opens the homework editor for this lesson (`?lessonId=`: the participants, the course, the
 * plan's pages and videos, the deadline at the next lesson; the route links it). «Привязать» picks in place
 * either a recent assignment of the participants not linked to a lesson, or a bank item: its working draft for
 * the participants goes on the lesson. A cancelled lesson takes no new homework.
 */
@Component({
  selector: 'tb-lesson-homework-section',
  imports: [FormsModule, RouterLink, Button, Menu, Select, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let ids = lesson().assignmentIds;
    @if (ids.length > 0 || !cancelled()) {
      <section class="tb-lesson-homework" [attr.aria-label]="t.title">
        <h3 class="tb-lesson-homework__title">{{ t.title }}</h3>
        @if (ids.length > 0) {
          <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
            @for (row of rows(); track row.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i tb-i-assignment"></i
                ></span>
                <div class="tb-list__text">
                  @if (row.summary; as item) {
                    <a
                      class="tb-list__title tb-lesson-homework__link"
                      [routerLink]="linkOf(item)"
                      >{{ item.title }}</a
                    >
                  } @else {
                    <span class="tb-list__title tb-muted">{{
                      loaded() ? t.deleted : t.loading
                    }}</span>
                  }
                </div>
                <div class="tb-list__trail">
                  @if (row.summary; as item) {
                    <p-tag
                      [value]="progressOf(item).label"
                      [severity]="progressOf(item).severity ?? undefined"
                    />
                  }
                  <p-button
                    icon="tb-i tb-i-more_vert"
                    severity="secondary"
                    [text]="true"
                    [rounded]="true"
                    [ariaLabel]="t.more(row.summary?.title ?? t.deleted)"
                    aria-haspopup="menu"
                    [loading]="unlinking() === row.id"
                    (onClick)="openMenu(row.id, $event)"
                  />
                </div>
              </li>
            }
          </ul>
          <p-menu #menu [model]="menuItems" [popup]="true" appendTo="body" />
        }
        @if (cancelled()) {
          <!-- a cancelled lesson keeps what it has and takes nothing new -->
        } @else if (picking()) {
          <div class="tb-lesson-homework__pick">
            <p-select
              [options]="groups()"
              [group]="true"
              optionGroupLabel="label"
              optionGroupChildren="items"
              optionLabel="title"
              optionValue="key"
              [(ngModel)]="chosen"
              [placeholder]="t.choose"
              [filter]="true"
              filterBy="title"
              [loading]="!choicesLoaded()"
              [emptyMessage]="t.pickEmpty"
              [ariaLabel]="t.pickLabel"
              appendTo="body"
              [fluid]="true"
            />
            <div class="tb-lesson-homework__actions">
              <p-button
                [label]="t.cancel"
                [text]="true"
                [disabled]="linking()"
                (onClick)="picking.set(false)"
              />
              <p-button
                [label]="t.link"
                [loading]="linking()"
                [disabled]="chosen() === null"
                (onClick)="link()"
              />
            </div>
          </div>
        } @else {
          @if (ids.length === 0) {
            <p class="tb-muted tb-lesson-homework__empty">{{ t.empty }}</p>
          }
          <div class="tb-lesson-homework__actions tb-lesson-homework__actions--start">
            <p-button
              [label]="t.give"
              icon="tb-i tb-i-add"
              severity="secondary"
              (onClick)="give()"
            />
            <p-button
              [label]="t.attach"
              icon="tb-i tb-i-link"
              variant="outlined"
              (onClick)="pick()"
            />
          </div>
        }
      </section>
    }
  `,
  styles: `
    .tb-lesson-homework {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-homework__title {
      margin: var(--tb-space-2) 0 0;
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
    }

    .tb-lesson-homework__link {
      color: inherit;
    }

    .tb-lesson-homework__link:hover {
      text-decoration: underline;
    }

    .tb-lesson-homework__empty {
      margin: 0;
    }

    .tb-lesson-homework__pick {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-lesson-homework__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--tb-space-2);
    }

    .tb-lesson-homework__actions--start {
      justify-content: flex-start;
    }
  `,
})
export class LessonHomeworkSection {
  protected readonly t = T.lessonHomework;
  private readonly homework = inject(HomeworkApi);
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);

  readonly lesson = input.required<ScheduledLesson>();
  /** Homework was linked to the lesson or taken off: the lesson as the server returned it. */
  readonly changed = output<ScheduledLesson>();

  protected readonly cancelled = computed(() => this.lesson().status === 'CANCELLED');
  /** The teacher's working assignments, read once the lesson has homework or the picker opens. */
  private readonly assignments = signal<readonly AssignmentSummary[]>([]);
  protected readonly loaded = signal(false);
  private loading = false;
  protected readonly rows = computed<LinkedRow[]>(() => {
    const byId = new Map(this.assignments().map((assignment) => [assignment.id, assignment]));
    return this.lesson().assignmentIds.map((id) => ({ id, summary: byId.get(id) ?? null }));
  });
  protected readonly picking = signal(false);
  readonly choices = signal<readonly HomeworkChoice[]>([]);
  protected readonly choicesLoaded = signal(false);
  protected readonly groups = computed<ChoiceGroup[]>(() => {
    const recent = this.choices().filter((choice) => !choice.bank);
    const bank = this.choices().filter((choice) => choice.bank);
    return [
      ...(recent.length > 0 ? [{ label: this.t.recent, items: recent }] : []),
      ...(bank.length > 0 ? [{ label: this.t.fromBank, items: bank }] : []),
    ];
  });
  /** The key of the chosen picker item. */
  readonly chosen = signal<string | null>(null);
  protected readonly linking = signal(false);
  /** The assignment being taken off. */
  protected readonly unlinking = signal<string | null>(null);
  private menuFor: string | null = null;
  private readonly menu = viewChild<Menu>('menu');

  protected readonly menuItems: MenuItem[] = [
    {
      label: T.lessonHomework.unlink,
      icon: 'tb-i tb-i-link_off',
      command: () => {
        this.unlink();
      },
    },
  ];

  constructor() {
    effect(() => {
      const ids = this.lesson().assignmentIds;
      untracked(() => {
        const known = new Set(this.assignments().map((assignment) => assignment.id));
        if (ids.some((id) => !known.has(id))) {
          this.load();
        }
      });
    });
  }

  private load(): void {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.homework.assignments().subscribe({
      next: (assignments) => {
        this.loading = false;
        this.assignments.set(assignments);
        this.loaded.set(true);
      },
      error: () => {
        this.loading = false;
        this.loaded.set(true);
      },
    });
  }

  protected progressOf(assignment: AssignmentSummary): ReturnType<typeof assignmentProgress> {
    return assignmentProgress(assignment);
  }

  /** A draft opens in its editor, a given-out assignment on its page. */
  protected linkOf(assignment: AssignmentSummary): string[] {
    return assignment.totalTasks === 0
      ? ['/teacher/homework', assignment.id, 'edit']
      : ['/teacher/homework', assignment.id];
  }

  /** «Задать»: the homework editor for this lesson. */
  protected give(): void {
    void this.router.navigate(['/teacher/homework/new'], {
      queryParams: { lessonId: this.lesson().id },
    });
  }

  protected openMenu(assignmentId: string, event: Event): void {
    this.menuFor = assignmentId;
    this.menu()?.toggle(event);
  }

  /**
   * «Привязать»: the participants' assignments of the last days that no lesson has (the links of the lessons
   * around today are read for that), then the bank items.
   */
  protected pick(): void {
    this.chosen.set(null);
    this.picking.set(true);
    this.choicesLoaded.set(false);
    const students = new Set(lessonStudents(this.lesson()));
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const since = now - RECENT_DAYS * day;
    const linked = this.scheduleApi
      .lessons(
        toIsoDate(new Date(now - LINKS_DAYS * day)),
        toIsoDate(new Date(now + LINKS_DAYS * day)),
      )
      .pipe(
        map((lessons) => new Set(lessons.flatMap((lesson) => lesson.assignmentIds))),
        catchError(() => of(new Set<string>())),
      );
    const working = this.homework.assignments().pipe(catchError(() => of([])));
    const bank = this.homework.assignments(true).pipe(
      catchError((error: unknown) => {
        this.snackbar.error(describeError(error, T.lessonHomework.linkFailed));
        return of([]);
      }),
    );
    forkJoin([linked, working, bank]).subscribe(([taken, assignments, items]) => {
      const mine = this.lesson().assignmentIds;
      const recent = assignments
        .filter(
          (assignment) =>
            !taken.has(assignment.id) &&
            !mine.includes(assignment.id) &&
            new Date(assignment.createdAt).getTime() >= since &&
            assignment.studentIds.some((id) => students.has(id)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((assignment) => ({
          key: `a:${assignment.id}`,
          id: assignment.id,
          bank: false,
          title: assignment.title,
        }));
      const originals = [...items]
        .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
        .map((item) => ({ key: `b:${item.id}`, id: item.id, bank: true, title: item.title }));
      this.choices.set([...recent, ...originals]);
      this.choicesLoaded.set(true);
    });
  }

  /** Links the chosen assignment; a bank item gives a draft for the participants first (deleted if refused). */
  protected link(): void {
    const choice = this.choices().find((candidate) => candidate.key === this.chosen());
    if (choice === undefined || this.linking()) {
      return;
    }
    const lesson = this.lesson();
    let draft: string | null = null;
    this.linking.set(true);
    const linked: Observable<ScheduledLesson> = choice.bank
      ? this.homework.use(choice.id, lessonStudents(lesson)).pipe(
          switchMap((copy) => {
            draft = copy.id;
            return this.scheduleApi
              .linkHomework(lesson.id, copy.id)
              .pipe(catchError((error: unknown) => this.dropCopy(copy.id, error)));
          }),
        )
      : this.scheduleApi.linkHomework(lesson.id, choice.id);
    linked.subscribe({
      next: (saved) => {
        this.linking.set(false);
        this.picking.set(false);
        this.loaded.set(false);
        this.assignments.set([]);
        const copy = draft;
        if (copy === null) {
          this.snackbar.success(T.lessonHomework.linked);
        } else {
          this.snackbar.link(T.lessonHomework.used, T.lessonHomework.openDraft, () => {
            void this.router.navigate(['/teacher/homework', copy, 'edit']);
          });
        }
        this.changed.emit(saved);
      },
      error: (error: unknown) => {
        this.linking.set(false);
        // a failed «use» is shown by the error interceptor; the link is quiet
        if (!choice.bank || draft !== null) {
          this.snackbar.error(describeError(error, T.lessonHomework.linkFailed));
        }
      },
    });
  }

  /** «Отвязать»: the assignment comes off the lesson and stays as it is. */
  private unlink(): void {
    const assignmentId = this.menuFor;
    if (assignmentId === null || this.unlinking() !== null) {
      return;
    }
    this.unlinking.set(assignmentId);
    this.scheduleApi.unlinkHomework(this.lesson().id, assignmentId).subscribe({
      next: (lesson) => {
        this.unlinking.set(null);
        this.snackbar.success(T.lessonHomework.unlinked);
        this.changed.emit(lesson);
      },
      error: (error: unknown) => {
        this.unlinking.set(null);
        this.snackbar.error(describeError(error, T.lessonHomework.unlinkFailed));
      },
    });
  }

  private dropCopy(assignmentId: string, error: unknown): Observable<never> {
    this.homework
      .deleteAssignment(assignmentId)
      .pipe(catchError(() => of(null)))
      .subscribe();
    return throwError(() => error);
  }
}
