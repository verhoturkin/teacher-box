import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ListRow } from '@shared/ui/list-row';
import { PickedTextbook } from '../data-access/textbooks.models';
import { T } from '../i18n/texts';
import { TEXTBOOK_KIND_ICONS, TEXTBOOK_KIND_LABELS } from '../textbooks-labels';

/** «Учебник · с. 12-14» or «Рабочая тетрадь · весь учебник». */
function pagesText(textbook: PickedTextbook): string {
  return [
    TEXTBOOK_KIND_LABELS[textbook.kind],
    textbook.pages === null ? T.planEditor.whole : T.planEditor.pages(textbook.pages),
  ].join(' · ');
}

/** The textbooks of a lesson plan with their pages: the pages change, a textbook goes. */
@Component({
  selector: 'tb-plan-textbooks',
  imports: [ListRow, Button, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (textbooks().length > 0) {
      <ul class="tb-list" [attr.aria-label]="t.textbooks">
        @for (textbook of textbooks(); track textbook.textbookId) {
          <li tbListRow>
            <span class="tb-list__lead" aria-hidden="true"
              ><i [class]="icons[textbook.kind]"></i
            ></span>
            <div class="tb-list__text">
              <span class="tb-list__title">{{ textbook.title }}</span>
              <span class="tb-list__supporting">{{ details(textbook) }}</span>
            </div>
            <div class="tb-list__trail tb-list__trail--icons">
              <p-button
                icon="tb-i tb-i-edit"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="t.editPages(textbook.title)"
                [ariaLabel]="t.editPages(textbook.title)"
                (onClick)="edit.emit(textbook)"
              />
              <p-button
                icon="tb-i tb-i-close"
                [text]="true"
                [rounded]="true"
                severity="danger"
                [pTooltip]="t.unbind(textbook.title)"
                [ariaLabel]="t.unbind(textbook.title)"
                (onClick)="remove.emit(textbook)"
              />
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class PlanTextbooks {
  protected readonly t = T.planEditor;
  protected readonly icons = TEXTBOOK_KIND_ICONS;
  protected readonly details = pagesText;

  readonly textbooks = input.required<readonly PickedTextbook[]>();
  readonly edit = output<PickedTextbook>();
  readonly remove = output<PickedTextbook>();
}
