import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { LabelColor } from '@core/theme/label-colors';
import { IdentityApi } from '../data-access/identity-api';

type Colors = ReadonlyMap<string, LabelColor>;

function colorsOf(rows: readonly { id: string; color: LabelColor | null }[]): Colors {
  return new Map(
    rows.flatMap((row): [string, LabelColor][] =>
      row.color === null ? [] : [[row.id, row.color]],
    ),
  );
}

/**
 * The colours of the teacher's students and groups, looked up by id in every list of the teacher: the other
 * modules' rows carry only the ids. Loaded when the teacher's area opens (app.routes.ts); the dialogs tell a saved
 * colour at once.
 */
@Injectable({ providedIn: 'root' })
export class TeacherColors {
  private readonly api = inject(IdentityApi);
  private readonly students = signal<Colors>(new Map());
  private readonly groups = signal<Colors>(new Map());

  /** Reads the colours of all students and groups; a failed load leaves the lists without colours. */
  load(): void {
    forkJoin([
      this.api.listStudents(quietContext()),
      this.api.listGroups(quietContext()),
    ]).subscribe({
      next: ([students, groups]) => {
        this.students.set(colorsOf(students));
        this.groups.set(colorsOf(groups));
      },
      error: () => undefined,
    });
  }

  /** The colour of a student; `null`: none (or not a student). */
  student(id: string | null | undefined): LabelColor | null {
    return id == null ? null : (this.students().get(id) ?? null);
  }

  /** The colour of a group; `null`: none. */
  group(id: string | null | undefined): LabelColor | null {
    return id == null ? null : (this.groups().get(id) ?? null);
  }

  /** The colours of all students or all groups by id. */
  all(kind: 'student' | 'group'): Colors {
    return kind === 'student' ? this.students() : this.groups();
  }

  /** The colour of a lesson's or a board's owner: its group, else its student. */
  owner(
    studentId: string | null | undefined,
    groupId: string | null | undefined,
  ): LabelColor | null {
    return groupId == null ? this.student(studentId) : this.group(groupId);
  }

  /** A student just saved or loaded. */
  rememberStudent(student: { id: string; color: LabelColor | null }): void {
    this.students.update((colors) => remember(colors, student));
  }

  /** A group just saved or loaded. */
  rememberGroup(group: { id: string; color: LabelColor | null }): void {
    this.groups.update((colors) => remember(colors, group));
  }
}

function remember(colors: Colors, row: { id: string; color: LabelColor | null }): Colors {
  if ((colors.get(row.id) ?? null) === row.color) {
    return colors;
  }
  const next = new Map(colors);
  if (row.color === null) {
    next.delete(row.id);
  } else {
    next.set(row.id, row.color);
  }
  return next;
}
