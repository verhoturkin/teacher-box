import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyBoard } from '../data-access/boards.models';
import { boardRoute } from '../boards-labels';

/** The student's boards as a list: an Excalidraw board opens in the portal, an external one in a new tab. */
@Component({
  selector: 'tb-my-board-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-list">
      @for (board of boards(); track board.id) {
        <li>
          <span class="tb-list__lead" aria-hidden="true"
            ><i [class]="board.kind === 'EXCALIDRAW' ? 'pi pi-th-large' : 'pi pi-external-link'"></i
          ></span>
          <div class="tb-list__text">
            @if (board.kind === 'EXCALIDRAW') {
              <a class="tb-list__title tb-link" [routerLink]="route(board.id)">{{ board.title }}</a>
            } @else {
              <a class="tb-list__title tb-link" [href]="board.url" target="_blank" rel="noopener">{{
                board.title
              }}</a>
            }
            <span class="tb-list__supporting">
              @if (board.groupNames.length > 0) {
                {{ board.groupNames.length > 1 ? 'группы' : 'группа' }}
                «{{ board.groupNames.join('», «') }}» ·
              }
              @if (board.kind === 'EXCALIDRAW') {
                изменена {{ board.updatedAt | date: 'dd.MM.yyyy HH:mm' }}
              } @else {
                внешняя доска
              }
            </span>
          </div>
        </li>
      }
    </ul>
  `,
})
export class MyBoardList {
  readonly boards = input<readonly MyBoard[]>([]);

  protected route(boardId: string): string {
    return boardRoute('cabinet', boardId);
  }
}
