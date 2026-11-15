import { HttpContext } from '@angular/common/http';
import { Signal, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { Observable } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { FilterMenuChip } from '@shared/ui/filter-chips';

/** One student or one group in the «Кому» select: `student:<id>` or `group:<id>`. */
interface WhomOption {
  readonly label: string;
  readonly value: string;
}

/** The texts of the filter. */
export interface WhomTexts {
  readonly groupsOption: string;
  readonly studentsOption: string;
  readonly whomAll: string;
  readonly whomChosen: (name: string) => string;
  readonly everyone: string;
}

/** Where the students and the groups come from (the identity facade). */
export interface WhomDirectory {
  listStudents(
    context: HttpContext,
  ): Observable<readonly { id: string; displayName: string; status: string }[]>;
  listGroups(context: HttpContext): Observable<
    readonly {
      id: string;
      name: string;
      archivedAt: string | null;
      members: readonly { id: string }[];
    }[]
  >;
}

/**
 * «Кому» of the homework list: one student or one group, a select from medium and a chip with a menu on a
 * phone. Created in an injection context.
 */
export class WhomFilter {
  /** The students and the groups to choose from. */
  private readonly students = signal<{ id: string; name: string }[]>([]);
  private readonly groups = signal<{ id: string; name: string; memberIds: string[] }[]>([]);
  readonly control: FormControl<string | null>;
  private readonly value: Signal<string | null>;

  readonly options = computed(() => {
    const groups = this.groups().map((g): WhomOption => ({
      label: g.name,
      value: `group:${g.id}`,
    }));
    const students = this.students().map((s): WhomOption => ({
      label: s.name,
      value: `student:${s.id}`,
    }));
    return [
      ...(groups.length > 0 ? [{ label: this.t.groupsOption, items: groups }] : []),
      { label: this.t.studentsOption, items: students },
    ];
  });
  /** «Кому: все ▾»: the chip of a phone, its menu lists the same groups and students as the select. */
  readonly chip = computed<FilterMenuChip>(() => {
    const value = this.value();
    const options = this.options().flatMap((group) => group.items);
    const chosen = value === null ? undefined : options.find((option) => option.value === value);
    const item = (option: WhomOption): MenuItem => ({
      label: option.label,
      command: () => {
        this.control.setValue(option.value);
      },
    });
    return {
      label: chosen === undefined ? this.t.whomAll : this.t.whomChosen(chosen.label),
      selected: chosen !== undefined,
      items: [
        {
          label: this.t.everyone,
          command: () => {
            this.control.setValue(null);
          },
        },
        ...this.options().map((group) => ({
          label: group.label,
          items: group.items.map(item),
        })),
      ],
    };
  });
  /** The ids of the students «Кому» stands for; `null` — everybody. */
  readonly ids = computed<ReadonlySet<string> | null>(() => {
    const value = this.value();
    if (value === null || value === '') {
      return null;
    }
    const id = value.slice(value.indexOf(':') + 1);
    return new Set(
      value.startsWith('group:')
        ? (this.groups().find((group) => group.id === id)?.memberIds ?? [])
        : [id],
    );
  });
  /** The id of the group or student «Кому» stands for; `null` — everybody. */
  readonly id = computed(() => {
    const value = this.value();
    return value === null || value === '' ? null : value.slice(value.indexOf(':') + 1);
  });

  /** `initial` — `student:<id>` or `group:<id>` of the address. */
  constructor(
    initial: string | null,
    private readonly t: WhomTexts,
    private readonly identity: WhomDirectory,
  ) {
    this.control = new FormControl<string | null>(initial);
    this.value = toSignal(this.control.valueChanges, { initialValue: this.control.value });
  }

  /** The active students and the groups not archived. */
  load(): void {
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, name: student.displayName })),
      );
    });
    this.identity.listGroups(quietContext()).subscribe((groups) => {
      this.groups.set(
        groups
          .filter((group) => group.archivedAt === null)
          .map((group) => ({
            id: group.id,
            name: group.name,
            memberIds: group.members.map((member) => member.id),
          })),
      );
    });
  }
}
