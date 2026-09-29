import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { Board } from '../data-access/boards.models';

/** Boards of a student or a group in a table: open the first one, or set them up. */
@Component({
  selector: 'tb-board-cell',
  imports: [Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (boards()[0]; as first) {
      <span class="tb-board-cell">
        <a [href]="first.url" target="_blank" rel="noopener">{{ first.title }}</a>
        @if (boards().length > 1) {
          <span class="tb-muted">+{{ boards().length - 1 }}</span>
        }
        <p-button
          icon="pi pi-cog"
          [text]="true"
          [pTooltip]="'Доски: ' + name()"
          severity="secondary"
          [rounded]="true"
          [ariaLabel]="'Доски: ' + name()"
          (onClick)="edit.emit()"
        />
      </span>
    } @else {
      <p-button
        label="Добавить"
        icon="pi pi-th-large"
        [text]="true"
        [ariaLabel]="'Добавить доску: ' + name()"
        (onClick)="edit.emit()"
      />
    }
  `,
  styles: `
    .tb-board-cell {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
    }
  `,
})
export class BoardCell {
  readonly boards = input<readonly Board[]>([]);
  readonly name = input('');
  readonly edit = output();
}
