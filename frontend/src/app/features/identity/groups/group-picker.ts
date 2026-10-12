import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';
import { IdentityApi } from '../data-access/identity-api';
import { StudentGroup } from '../data-access/identity.models';
import { T } from '../i18n/texts';

/**
 * Groups for a selection of students, many at once like the students: choosing a group emits its students for the
 * host to add, taking one off emits those who are in no other chosen group for the host to remove. Hidden while there
 * are no groups.
 */
@Component({
  selector: 'tb-group-picker',
  imports: [FormsModule, MultiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (groups().length > 0) {
      <div class="tb-field">
        <label [for]="inputId()">{{ t.groups }}</label>
        <p-multiselect
          [inputId]="inputId()"
          [ngModel]="selected()"
          (ngModelChange)="choose($event)"
          [options]="groups()"
          optionLabel="name"
          optionValue="id"
          [placeholder]="t.placeholder"
          display="chip"
          appendTo="body"
          [fluid]="true"
        />
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class GroupPicker implements OnInit {
  protected readonly t = T.groupPicker;
  private readonly api = inject(IdentityApi);

  readonly inputId = input('group-picker');
  /** Ids of the chosen groups; the host clears it when it starts a new selection. */
  readonly selected = model<readonly string[]>([]);
  /** Ids of the current students of a group just chosen. */
  readonly picked = output<string[]>();
  /** Ids of the students of a group taken off who are in no other chosen group. */
  readonly dropped = output<string[]>();

  protected readonly groups = signal<StudentGroup[]>([]);

  ngOnInit(): void {
    this.api.listGroups().subscribe((groups) => {
      this.groups.set(
        groups.filter((group) => group.archivedAt === null && group.members.length > 0),
      );
    });
  }

  choose(ids: readonly string[]): void {
    const before = new Set(this.selected());
    const after = new Set(ids);
    this.selected.set(ids);
    const added = this.groups().filter((group) => after.has(group.id) && !before.has(group.id));
    const removed = this.groups().filter((group) => before.has(group.id) && !after.has(group.id));
    if (added.length > 0) {
      this.picked.emit([...new Set(added.flatMap(members))]);
    }
    if (removed.length > 0) {
      const kept = new Set(
        this.groups()
          .filter((group) => after.has(group.id))
          .flatMap(members),
      );
      this.dropped.emit([...new Set(removed.flatMap(members))].filter((id) => !kept.has(id)));
    }
  }
}

/** Members who still have access. */
function members(group: StudentGroup): string[] {
  return group.members
    .filter((member) => member.status !== 'DEACTIVATED')
    .map((member) => member.id);
}
