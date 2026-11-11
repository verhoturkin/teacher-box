import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SearchField } from '@shared/ui/search-field';

/** §9 The M3 docked search bar `tb-search-field`: a filled pill, «×» while there is text, Esc clears. */
@Component({
  selector: 'tb-gallery-search',
  imports: [ReactiveFormsModule, SearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <tb-search-field [formControl]="query" label="Search students" placeholder="Name or login" />
      <code class="tb-gallery-name">tb-search-field [formControl] label placeholder</code>
    </div>
  `,
})
export class SearchSample {
  protected readonly query = new FormControl('Anna', { nonNullable: true });
}
