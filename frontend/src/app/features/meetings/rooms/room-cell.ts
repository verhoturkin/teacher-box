import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { MeetingRoom } from '../data-access/meetings.models';

/** The room of a student or a group in a table: open it, or set it up. */
@Component({
  selector: 'tb-room-cell',
  imports: [Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (room(); as room) {
      <span class="tb-room-cell">
        <a [href]="room.joinUrl" target="_blank" rel="noopener" [pTooltip]="room.joinUrl">
          {{ room.telemost ? 'Телемост' : 'Ссылка' }}
        </a>
        <p-button icon="pi pi-cog" [text]="true" [rounded]="true" size="small" [ariaLabel]="'Видеовстреча: ' + name()" (onClick)="edit.emit()" />
      </span>
    } @else {
      <p-button label="Добавить" icon="pi pi-video" [text]="true" size="small" [ariaLabel]="'Добавить видеовстречу: ' + name()" (onClick)="edit.emit()" />
    }
  `,
  styles: `
    .tb-room-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  `,
})
export class RoomCell {
  readonly room = input<MeetingRoom | null>(null);
  /** Name of the student or the group (for screen readers). */
  readonly name = input('');
  readonly edit = output();
}
