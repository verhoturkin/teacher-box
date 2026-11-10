import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MemberSelection, StudentGroup } from '@features/identity/parts';
import { Avatar } from '@shared/ui/avatar';
import { InputChip } from '@shared/ui/input-chip';
import { AssignmentDetails } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { Due, DueChips } from '@features/homework/ui/due-chips';
import { RecipientsField } from '@features/homework/ui/recipients-field';

/**
 * «Кому · Срок» of the assignment editor (sketch 11): a draft chooses its students and groups, an issued
 * assignment shows its students read-only with «Выдать ещё»; the due date as chips below.
 */
@Component({
  selector: 'tb-editor-recipients',
  imports: [Button, Card, Avatar, InputChip, DueChips, RecipientsField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-card styleClass="tb-section-card" class="tb-editor__who-card">
      <div class="tb-editor__who">
        @if (draft()) {
          <tb-recipients-field
            inputId="editor-students"
            [control]="members()"
            [students]="students()"
            [groups]="groups()"
          />
        } @else {
          <div class="tb-field">
            <span id="editor-given">{{ c.whom }}</span>
            <div class="tb-editor__chips" role="group" aria-labelledby="editor-given">
              @for (task of tasks(); track task.taskId) {
                <tb-input-chip [label]="task.studentName" [readonly]="true">
                  <tb-avatar lead [name]="task.studentName" size="1.5rem" />
                </tb-input-chip>
              }
              <p-button
                [label]="t.assignMore"
                icon="tb-i tb-i-add"
                severity="secondary"
                (onClick)="more.emit()"
              />
            </div>
          </div>
        }

        <tb-due-chips
          [lesson]="lesson()"
          [choice]="choice()"
          (choiceChange)="choiceChange.emit($event)"
          [date]="date()"
          (dateChange)="dateChange.emit($event)"
        />
      </div>
    </p-card>
  `,
  styles: `
    .tb-editor__who-card {
      order: -1;
    }

    @container editor-form (width >= 52rem) {
      .tb-editor__who {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .tb-editor__who {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
      gap: var(--tb-space-4) var(--tb-space-6);
    }

    .tb-editor__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class EditorRecipients {
  protected readonly t = T.editor;
  protected readonly c = T.create;

  /** A new assignment or a saved draft: its students are still a choice. */
  readonly draft = input.required<boolean>();
  /** The chosen students and groups of a draft. */
  readonly members = input.required<FormControl<MemberSelection[]>>();
  readonly students = input.required<readonly { id: string; name: string }[]>();
  readonly groups = input.required<readonly StudentGroup[]>();
  /** The tasks of an issued assignment: its students as read-only chips. */
  readonly tasks = input.required<AssignmentDetails['tasks']>();
  /** The next lesson of the chosen students, for «К уроку». */
  readonly lesson = input<Date | null>(null);
  readonly choice = input.required<Due>();
  readonly date = input.required<Date | null>();

  /** «Выдать ещё». */
  readonly more = output();
  readonly choiceChange = output<Due>();
  readonly dateChange = output<Date | null>();
}
