import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { T } from '../i18n/texts';
/** A group the teacher can plan lessons with. */
export interface LessonGroup {
  readonly id: string;
  readonly name: string;
  /** Topic of a new lesson with the group, if the teacher set one. */
  readonly defaultTopic?: string | null;
}

/** Whose default topic can be filled in: students and groups of the «with whom» select. */
export interface TopicOwners {
  readonly students: readonly { readonly id: string; readonly defaultTopic?: string | null }[];
  readonly groups: readonly LessonGroup[];
}

/** A student or a group in one select: `student:<id>` or `group:<id>`. */
export type OwnerValue = `student:${string}` | `group:${string}`;

export interface OwnerOption {
  readonly label: string;
  readonly value: OwnerValue;
}

export interface OwnerOptionGroup {
  readonly label: string;
  readonly items: readonly OwnerOption[];
}

/** Options of the «with whom» select: groups first (if any), then students. */
export function ownerOptions(
  students: readonly { readonly id: string; readonly displayName: string }[],
  groups: readonly LessonGroup[],
): OwnerOptionGroup[] {
  const studentItems = students.map((student): OwnerOption => ({
    label: student.displayName,
    value: `student:${student.id}`,
  }));
  if (groups.length === 0) {
    return [{ label: T.owners.students, items: studentItems }];
  }
  return [
    {
      label: T.owners.groups,
      items: groups.map((group): OwnerOption => ({
        label: group.name,
        value: `group:${group.id}`,
      })),
    },
    { label: T.owners.students, items: studentItems },
  ];
}

/** The ids a request of the backend expects: exactly one of them is set. */
export function ownerIds(value: OwnerValue): { studentId: string | null; groupId: string | null } {
  return value.startsWith('group:')
    ? { studentId: null, groupId: value.slice('group:'.length) }
    : { studentId: value.slice('student:'.length), groupId: null };
}

/** The default topic of the chosen student or group; `''` if there is none. */
export function defaultTopic(value: OwnerValue | null, owners: TopicOwners): string {
  if (value === null) {
    return '';
  }
  const { studentId, groupId } = ownerIds(value);
  const owner =
    groupId === null
      ? owners.students.find((student) => student.id === studentId)
      : owners.groups.find((group) => group.id === groupId);
  return owner?.defaultTopic ?? '';
}

/**
 * Fills the topic of a new lesson or series with the default of the chosen student or group. A topic the
 * teacher typed stays; one filled in for the previous choice is replaced. Call in an injection context.
 */
export function followDefaultTopic(
  owner: FormControl<OwnerValue | null>,
  topic: FormControl<string>,
  owners: () => TopicOwners,
  isNew: () => boolean,
): void {
  let filled = '';
  owner.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((value) => {
    if (!isNew()) {
      filled = '';
      return;
    }
    if (topic.value.trim() === '' || topic.value === filled) {
      filled = defaultTopic(value, owners());
      topic.setValue(filled);
    } else {
      filled = '';
    }
  });
}

/** The select value of an existing lesson or series. */
export function ownerValue(item: {
  readonly studentId: string | null;
  readonly groupId: string | null;
}): OwnerValue | null {
  if (item.groupId !== null) {
    return `group:${item.groupId}`;
  }
  return item.studentId === null ? null : `student:${item.studentId}`;
}
