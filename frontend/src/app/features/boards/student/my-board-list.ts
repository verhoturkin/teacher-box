import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyBoard } from '../data-access/boards.models';
import { boardRoute } from '../boards-labels';
import { T } from '../i18n/texts';

/**
 * The student's boards as a list: a tap anywhere on a row opens the board — an Excalidraw board in the portal, an
 * external one in a new tab.
 */
@Component({
  selector: 'tb-my-board-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="label()">
      @for (board of boards(); track board.id) {
        <!-- a tap anywhere on the row opens the board: the title link covers the row -->
        <li class="tb-list__item--link">
          <span class="tb-list__lead" aria-hidden="true"
            ><i [class]="board.kind === 'EXCALIDRAW' ? 'pi pi-tb-board' : 'pi pi-external-link'"></i
          ></span>
          <div class="tb-list__text">
            @if (board.kind === 'EXCALIDRAW') {
              <a class="tb-list__title tb-list__link" [routerLink]="route(board.id)">{{
                board.title
              }}</a>
            } @else {
              <a
                class="tb-list__title tb-list__link"
                [href]="board.url"
                target="_blank"
                rel="noopener"
                >{{ board.title }}</a
              >
            }
            @if (board.groupNames.length > 0 || board.kind === 'EXCALIDRAW') {
              <span class="tb-list__supporting">
                @if (board.groupNames.length > 0) {
                  {{ board.groupNames.length > 1 ? t.groups : t.group }}
                  «{{ board.groupNames.join('», «') }}»
                }
                @if (board.groupNames.length > 0 && board.kind === 'EXCALIDRAW') {
                  ·
                }
                @if (board.kind === 'EXCALIDRAW') {
                  {{ t.changed((board.updatedAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}
                }
              </span>
            }
          </div>
        </li>
      }
    </ul>
  `,
})
export class MyBoardList {
  protected readonly t = T.myList;
  readonly boards = input<readonly MyBoard[]>([]);
  /** The name of the list for screen readers (the title of its card). */
  readonly label = input<string | null>(null);

  protected route(boardId: string): string {
    return boardRoute('cabinet', boardId);
  }
}
