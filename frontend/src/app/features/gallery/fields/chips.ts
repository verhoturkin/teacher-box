import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AssistChip } from '@shared/ui/assist-chip';
import { Avatar } from '@shared/ui/avatar';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { InputChip } from '@shared/ui/input-chip';

/** §10 Chips: filter chips over a list, assist chips (an optional action), input chips (a chosen entity). */
@Component({
  selector: 'tb-gallery-chips',
  imports: [AssistChip, Avatar, FilterChips, InputChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-cell">
      <li class="tb-gallery-cell">
        <tb-filter-chips label="Students" [chips]="filters" [(value)]="filter" />
        <code class="tb-gallery-name">tb-filter-chips [chips] [(value)]</code>
      </li>
      <li class="tb-gallery-row">
        <tb-assist-chip icon="attach_file">File</tb-assist-chip>
        <tb-assist-chip icon="person_add" [dashed]="true">Student or group</tb-assist-chip>
        <tb-assist-chip icon="menu_book" [disabled]="true">Textbook</tb-assist-chip>
        <code class="tb-gallery-name">tb-assist-chip icon [dashed] [disabled]</code>
      </li>
      <li class="tb-gallery-row">
        @for (name of chosen(); track name) {
          <tb-input-chip [label]="name" [removeLabel]="'Remove: ' + name" (removed)="remove(name)">
            <tb-avatar lead [name]="name" size="1.5rem" />
          </tb-input-chip>
        }
        <tb-input-chip label="Given" [readonly]="true">
          <i lead class="tb-i tb-i-check" aria-hidden="true"></i>
        </tb-input-chip>
        <code class="tb-gallery-name"
          >tb-input-chip [removeLabel] (removed), lead avatar or icon, [readonly]</code
        >
      </li>
    </ul>
  `,
})
export class ChipsSample {
  protected readonly filters: readonly FilterChip<string>[] = [
    { value: 'all', label: 'All' },
    { value: 'debt', label: 'In debt', count: 2 },
    { value: 'archive', label: 'Archived' },
  ];
  protected readonly filter = signal('all');
  protected readonly chosen = signal(['Anna Petrova', 'Ivan Orlov']);

  protected remove(name: string): void {
    this.chosen.update((names) => names.filter((other) => other !== name));
  }
}
