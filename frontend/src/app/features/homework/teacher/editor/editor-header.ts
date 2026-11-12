import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UrlTree } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { HelpButton } from '@features/help/parts';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '@features/homework/i18n/texts';

/**
 * The header of the assignment editor: the title as it is typed, «Как увидит ученик» of the test, the AI
 * assistant and «Выдать» of a draft (with «Выдать и разместить на доске»; a phone has «Выдать» alone) or
 * «Сохранить» of an issued assignment.
 */
@Component({
  selector: 'tb-editor-header',
  imports: [Button, Menu, HelpButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <tb-page-header
      class="tb-page-header--one-line"
      [title]="title()"
      [back]="back()"
      [backLabel]="backLabel()"
    >
      <tb-help-button help topic="teacher/homework" />
      @if (studentView()) {
        <p-button
          [label]="compact() ? undefined : t.studentView"
          [ariaLabel]="t.studentView"
          icon="tb-i tb-i-visibility"
          severity="secondary"
          [attr.aria-haspopup]="'dialog'"
          (onClick)="openStudentView.emit()"
        />
      }
      @if (aiEnabled()) {
        <p-button
          [label]="compact() ? undefined : t.aiTitle"
          [ariaLabel]="t.aiTitle"
          icon="tb-i tb-i-auto_awesome"
          severity="secondary"
          [ariaExpanded]="aiExpanded()"
          (onClick)="toggleAi.emit()"
        />
      }
      @if (draft() && compact()) {
        <!-- a phone (sketch 21): «Выдать» alone; the board is not chosen there -->
        <p-button
          [label]="c.assign"
          [loading]="pending() && !autosaving()"
          (onClick)="save.emit(false)"
        />
      } @else if (draft()) {
        @if (savedAt(); as at) {
          <span class="tb-editor__saved" role="status">{{ t.savedAt(at) }}</span>
        }
        <span class="tb-split" role="group" [attr.aria-label]="c.assign">
          <p-button
            styleClass="tb-split__main"
            [label]="c.assign"
            icon="tb-i tb-i-send"
            [loading]="pending() && !autosaving()"
            (onClick)="save.emit(false)"
          />
          <p-button
            styleClass="tb-split__more"
            icon="tb-i tb-i-expand_more"
            [ariaLabel]="c.assignMenu"
            (onClick)="menu.toggle($event)"
          />
          <p-menu #menu [model]="assignMenu" [popup]="true" appendTo="body" />
        </span>
      } @else {
        <p-button
          [label]="t.save"
          icon="tb-i tb-i-check"
          [loading]="pending()"
          (onClick)="save.emit(false)"
        />
      }
    </tb-page-header>
  `,
  styles: `
    .tb-editor__saved {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }
  `,
})
export class EditorHeader {
  protected readonly t = T.editor;
  protected readonly c = T.create;

  readonly title = input.required<string>();
  readonly back = input.required<string | readonly unknown[] | UrlTree>();
  readonly backLabel = input.required<string>();
  /** The test has questions and is open: «Как увидит ученик». */
  readonly studentView = input.required<boolean>();
  readonly aiEnabled = input.required<boolean>();
  readonly aiExpanded = input.required<boolean>();
  /** A new assignment or a saved draft: «Выдать»; otherwise «Сохранить». */
  readonly draft = input.required<boolean>();
  readonly compact = input.required<boolean>();
  /** «сохранено · HH:mm» of the last autosave. */
  readonly savedAt = input.required<string | null>();
  readonly pending = input.required<boolean>();
  readonly autosaving = input.required<boolean>();

  readonly openStudentView = output();
  readonly toggleAi = output();
  /** «Выдать» or «Сохранить»; `true` — «Выдать и разместить на доске». */
  readonly save = output<boolean>();

  protected readonly assignMenu: MenuItem[] = [
    {
      label: T.create.assignToBoard,
      icon: 'tb-i tb-i-co_present',
      command: () => {
        this.save.emit(true);
      },
    },
  ];
}
