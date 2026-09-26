import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { IdentityApi } from '../data-access/identity-api';
import { StudentGroup } from '../data-access/identity.models';

/**
 * Adds all students of a group to a selection of students: the host merges the emitted ids into
 * its own list. Hidden while there are no groups.
 */
@Component({
  selector: 'tb-group-picker',
  imports: [ReactiveFormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (groups().length > 0) {
      <p-select
        [inputId]="inputId()"
        [formControl]="choice"
        [options]="groups()"
        optionLabel="name"
        placeholder="Добавить группу"
        ariaLabel="Добавить учеников группы"
        appendTo="body"
      />
    }
  `,
})
export class GroupPicker implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly inputId = input('group-picker');
  /** Ids of the current members of the chosen group. */
  readonly picked = output<string[]>();

  protected readonly groups = signal<StudentGroup[]>([]);
  readonly choice = new FormControl<StudentGroup | null>(null);

  ngOnInit(): void {
    this.api.listGroups().subscribe((groups) => {
      this.groups.set(groups.filter((group) => group.archivedAt === null && group.members.length > 0));
    });
    this.choice.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((group) => {
      if (group !== null) {
        this.picked.emit(group.members.filter((member) => member.status !== 'DEACTIVATED').map((member) => member.id));
        this.choice.setValue(null, { emitEvent: false });
      }
    });
  }
}
