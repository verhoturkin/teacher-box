import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UrlTree } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '@features/homework/i18n/texts';

/**
 * The header of the assignment editor: the title as it is typed, «Как увидит ученик» of the test, the AI
 * assistant and «Выдать» of a draft (with «Выдать и разместить на доске»; a phone has «Выдать» alone) or
 * «Сохранить» of an issued assignment. A bank item (roadmap 11) has «Готово» instead and the tag «В банке»; «⋮»
 * keeps «Сохранить в банк» / «Обновить в банке» of a saved working assignment.
 */
@Component({
  selector: 'tb-editor-header',
  imports: [Button, Menu, Tag, HelpButton, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <tb-page-header
      class="tb-page-header--one-line"
      [title]="title()"
      [back]="back()"
      [backLabel]="backLabel()"
    >
      @if (bank()) {
        <p-tag meta [value]="b.bankItem" severity="secondary" />
      }
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
      @if (moreItems().length > 0) {
        <p-button
          icon="tb-i tb-i-more_vert"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [ariaLabel]="b.more"
          aria-haspopup="menu"
          [loading]="banking()"
          (onClick)="more.toggle($event)"
        />
        <p-menu #more [model]="moreItems()" [popup]="true" appendTo="body" />
      }
      @if (bank()) {
        @if (savedAt(); as at) {
          <span class="tb-editor__saved" role="status">{{ t.savedAt(at) }}</span>
        }
        <p-button
          [label]="b.done"
          icon="tb-i tb-i-check"
          [loading]="pending() && !autosaving()"
          (onClick)="done.emit()"
        />
      } @else if (draft() && compact()) {
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
      letter-spacing: var(--tb-tracking-body-s);
    }
  `,
})
export class EditorHeader {
  protected readonly t = T.editor;
  protected readonly c = T.create;
  protected readonly b = T.bank;

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
  /** A bank item: «Готово» in place of «Выдать». */
  readonly bank = input(false);
  /** The items of «⋮»; none — no button. */
  readonly moreItems = input<MenuItem[]>([]);
  /** The assignment is going into the bank. */
  readonly banking = input(false);

  readonly openStudentView = output();
  readonly toggleAi = output();
  /** «Выдать» or «Сохранить»; `true` — «Выдать и разместить на доске». */
  readonly save = output<boolean>();
  /** «Готово» of a bank item. */
  readonly done = output();

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
