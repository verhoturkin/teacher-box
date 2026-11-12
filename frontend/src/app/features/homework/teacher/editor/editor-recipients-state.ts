import { Signal, computed, inject, signal } from '@angular/core';
import {
  IdentityApi,
  MemberSelection,
  StudentGroup,
  memberRecipients,
} from '@features/identity/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { Due, dueAtOf } from '@features/homework/ui/due-chips';
import { NEXT_LESSON_DAYS, UpcomingLesson, UpcomingLessons, nextLessonStart } from '../next-lesson';

/** A student that can receive homework. */
export interface StudentOption {
  readonly id: string;
  readonly displayName: string;
}

/**
 * «Кому · Срок» of the assignment editor: the students and groups to choose from, who the assignment
 * goes to and its due date.
 */
export class EditorRecipientsState {
  private readonly identity = inject(IdentityApi);

  readonly students = signal<StudentOption[]>([]);
  readonly groups = signal<StudentGroup[]>([]);
  /** The student list is in: only then a draft's students are saved (an empty list must not wipe them). */
  readonly loaded = signal(false);
  readonly options = computed(() =>
    this.students().map((student) => ({ id: student.id, name: student.displayName })),
  );
  /** The students the assignment goes to: the chosen ones and the members of the chosen groups. */
  readonly recipients: Signal<string[]>;
  /** Lessons ahead, for the due date of a new assignment. */
  private readonly lessons = signal<readonly UpcomingLesson[]>([]);
  readonly nextLesson: Signal<Date | null>;
  readonly dueChoice = signal<Due>('lesson');
  readonly duePicked = signal<Date | null>(null);
  /** The teacher changed the due date: leaving asks. */
  readonly dueChanged = signal(false);
  readonly dueAt: Signal<Date | null>;

  constructor(members: Signal<readonly MemberSelection[]>, isNew: Signal<boolean>) {
    this.recipients = computed(() =>
      memberRecipients(
        members(),
        this.groups(),
        this.students().map((student) => student.id),
      ),
    );
    this.nextLesson = computed(() =>
      isNew() ? nextLessonStart(this.lessons(), this.recipients(), new Date()) : null,
    );
    this.dueAt = computed(() => dueAtOf(this.dueChoice(), this.nextLesson(), this.duePicked()));
  }

  /** The active students and the groups not archived. */
  load(): void {
    this.identity.listStudents().subscribe((students) => {
      this.loaded.set(true);
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
    this.identity.listGroups().subscribe((groups) => {
      this.groups.set(groups.filter((group) => group.archivedAt === null));
    });
  }

  /** The schedule's lessons of the next days, for «к следующему уроку». */
  loadLessons(upcoming: UpcomingLessons | undefined): void {
    const today = new Date();
    const until = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + NEXT_LESSON_DAYS,
    );
    upcoming?.(toIsoDate(today), toIsoDate(until)).subscribe({
      next: (lessons) => {
        this.lessons.set(lessons);
      },
      error: () => {
        // without the schedule the due date stays for the teacher to set
      },
    });
  }

  /** The due date as saved. */
  showDue(dueAt: string | null): void {
    this.dueChoice.set(dueAt === null ? 'none' : 'date');
    this.duePicked.set(dueAt === null ? null : new Date(dueAt));
  }

  chooseDue(choice: Due): void {
    this.dueChoice.set(choice);
    this.dueChanged.set(true);
  }

  pickDue(date: Date | null): void {
    this.duePicked.set(date);
    this.dueChanged.set(true);
  }
}
