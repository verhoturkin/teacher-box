import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from './teacher-colors';

/**
 * A student or a group in a `p-select` (options and the chosen value): an avatar in the label colour and the
 * name. `value` is `student:<id>`, `group:<id>` or a bare student id.
 */
@Component({
  selector: 'tb-owner-option',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-person' },
  template: `
    <tb-avatar [attr.data-tb-label]="label()" [name]="name()" size="1.5rem" />
    <span>{{ name() }}</span>
  `,
})
export class OwnerOption {
  private readonly colors = inject(TeacherColors);

  readonly name = input.required<string>();
  readonly value = input.required<string>();

  protected readonly label = computed(() => {
    const value = this.value();
    const id = value.slice(value.indexOf(':') + 1);
    return value.startsWith('group:') ? this.colors.groupLabel(id) : this.colors.studentLabel(id);
  });
}
