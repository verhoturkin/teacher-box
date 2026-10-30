import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MemberPicker, MemberSelection, StudentGroup } from '@features/identity/parts';
import { AssistChip } from '@shared/ui/assist-chip';
import { Avatar } from '@shared/ui/avatar';
import { InputChip } from '@shared/ui/input-chip';
import { T } from '../i18n/texts';

/** «Кому»: the chosen students and groups as input chips and a dashed chip that opens the picker. */
@Component({
  selector: 'tb-recipients-field',
  imports: [ReactiveFormsModule, AssistChip, Avatar, InputChip, MemberPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.whom }}</label>
      <div class="tb-recipients">
        @for (member of chosen(); track member.kind + member.id) {
          <tb-input-chip
            [label]="memberLabel(member)"
            [removeLabel]="t.removeMember(memberName(member))"
            (removed)="removeMember(member)"
          >
            @if (member.kind === 'GROUP') {
              <i lead class="tb-i tb-i-groups" aria-hidden="true"></i>
            } @else {
              <tb-avatar lead [name]="memberName(member)" size="1.5rem" />
            }
          </tb-input-chip>
        }
        <span class="tb-recipients__add">
          <tb-assist-chip icon="add" [dashed]="true" (click)="whom.open()">
            {{ t.whomPlaceholder }}
          </tb-assist-chip>
          <tb-member-picker
            #whom
            [inputId]="inputId()"
            [bare]="true"
            [formControl]="control()"
            [students]="students()"
            [groups]="groupOptions()"
          />
        </span>
      </div>
    </div>
  `,
  styles: `
    .tb-recipients {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-recipients__add {
      position: relative;
    }
  `,
})
export class RecipientsField {
  protected readonly t = T.create;
  readonly control = input.required<FormControl<MemberSelection[]>>();
  readonly students = input.required<readonly { id: string; name: string }[]>();
  readonly groups = input.required<readonly StudentGroup[]>();
  readonly inputId = input('recipients');

  protected readonly chosen = signal<readonly MemberSelection[]>([]);
  protected readonly groupOptions = computed(() =>
    this.groups().map((group) => ({ id: group.id, name: group.name })),
  );

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      this.chosen.set(control.value);
      const subscription = control.valueChanges.subscribe((value) => {
        this.chosen.set(value);
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  protected memberName(member: MemberSelection): string {
    return member.kind === 'GROUP'
      ? (this.groups().find((group) => group.id === member.id)?.name ?? '')
      : (this.students().find((student) => student.id === member.id)?.name ?? '');
  }

  /** A group carries the number of its students. */
  protected memberLabel(member: MemberSelection): string {
    const group =
      member.kind === 'GROUP'
        ? this.groups().find((candidate) => candidate.id === member.id)
        : undefined;
    return group === undefined
      ? this.memberName(member)
      : `${group.name} · ${String(group.members.length)}`;
  }

  protected removeMember(member: MemberSelection): void {
    const control = this.control();
    control.setValue(
      control.value.filter((chosen) => chosen.kind !== member.kind || chosen.id !== member.id),
    );
  }
}
