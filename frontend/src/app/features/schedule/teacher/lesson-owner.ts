/** A group the teacher can plan lessons with. */
export interface LessonGroup {
  readonly id: string;
  readonly name: string;
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
    return [{ label: 'Ученики', items: studentItems }];
  }
  return [
    {
      label: 'Группы',
      items: groups.map((group): OwnerOption => ({
        label: group.name,
        value: `group:${group.id}`,
      })),
    },
    { label: 'Ученики', items: studentItems },
  ];
}

/** The ids a request of the backend expects: exactly one of them is set. */
export function ownerIds(value: OwnerValue): { studentId: string | null; groupId: string | null } {
  return value.startsWith('group:')
    ? { studentId: null, groupId: value.slice('group:'.length) }
    : { studentId: value.slice('student:'.length), groupId: null };
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
