import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';

interface Row {
  readonly name: string;
  readonly lessons: number;
  readonly amount: string;
}

/**
 * §10 Tables `p-table styleClass="tb-cards"`: rows are tiles; on a phone each row is a card of `data-label`
 * pairs. `tb-col-main` — the main column, `tb-amount` — amounts, `[tbRowType]` types the row template.
 */
@Component({
  selector: 'tb-gallery-table',
  imports: [TableModule, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-table [value]="rows" styleClass="tb-cards">
      <ng-template #header>
        <tr>
          <th class="tb-col-main">Student</th>
          <th>Lessons</th>
          <th class="tb-amount">Charged</th>
        </tr>
      </ng-template>
      <ng-template #body let-row [tbRowType]="rows">
        <tr>
          <td data-label="Student" class="tb-col-main">{{ row.name }}</td>
          <td data-label="Lessons">{{ row.lessons }}</td>
          <td data-label="Charged" class="tb-amount">{{ row.amount }}</td>
        </tr>
      </ng-template>
    </p-table>
    <code class="tb-gallery-name"
      >p-table styleClass="tb-cards"; td[data-label]; ng-template #body [tbRowType]</code
    >
  `,
})
export class TableSample {
  protected readonly rows: Row[] = [
    { name: 'Anna Petrova', lessons: 8, amount: '12 000 ₽' },
    { name: 'Ivan Orlov', lessons: 4, amount: '6 000 ₽' },
  ];
}
