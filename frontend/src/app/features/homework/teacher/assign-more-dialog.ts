import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';
import { quietContext } from '@core/http/api-error.interceptor';
import { GroupPicker, IdentityApi } from '@features/identity/parts';
import { Busy } from '@shared/ui/busy';
import { SubmitFor } from '@shared/ui/submit-for';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { StudentOption } from './assignment-editor-page';

/** «Выдать ещё ученикам»: students and groups side by side; students who have the assignment are not offered. */
@Component({
  selector: 'tb-assign-more-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, MultiSelect, GroupPicker, SubmitFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.assignMore"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--wide"
      [draggable]="false"
    >
      <form id="assign-more-form" class="tb-assign" [formGroup]="form" (ngSubmit)="assign()">
        <div class="tb-field">
          <label for="assign-students">{{ t.students }}</label>
          <p-multiselect
            inputId="assign-students"
            [options]="unassigned()"
            [formControl]="toAssign"
            optionLabel="displayName"
            optionValue="id"
            [filter]="true"
            [filterPlaceHolder]="t.search"
            [ariaFilterLabel]="t.search"
            display="chip"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <tb-group-picker
          inputId="assign-group"
          [(selected)]="groups"
          (picked)="addStudents($event)"
          (dropped)="removeStudents($event)"
        />
      </form>
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          severity="success"
          [label]="t.assign"
          [loading]="busy.is('assign')"
          type="submit"
          tbSubmitFor="assign-more-form"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-assign {
      display: grid;
      gap: var(--tb-space-4);
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      align-items: start;
    }
  `,
})
export class AssignMoreDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.page;
  protected readonly busy = new Busy();
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);

  readonly visible = model(false);
  readonly assignmentId = input.required<string>();
  /** Students who already have the assignment. */
  readonly assigned = input<readonly string[]>([]);
  readonly saved = output<AssignmentDetails>();

  private readonly students = signal<StudentOption[]>([]);
  readonly toAssign = new FormControl<string[]>([], { nonNullable: true });
  /** `ngSubmit` needs a form directive: without it «Выдать» would submit the page. */
  protected readonly form = new FormGroup({ students: this.toAssign });
  /** The groups chosen. */
  protected readonly groups = signal<readonly string[]>([]);
  protected readonly unassigned = computed(() => {
    const assigned = new Set(this.assigned());
    return this.students().filter((student) => !assigned.has(student.id));
  });
  private readonly chosen = toSignal(this.toAssign.valueChanges, {
    initialValue: this.toAssign.value,
  });

  /** Opens the dialog empty, with the current students. */
  open(): void {
    this.toAssign.setValue([]);
    this.groups.set([]);
    this.visible.set(true);
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
  }

  /** Adds the students of a chosen group who do not have the assignment yet. */
  addStudents(ids: readonly string[]): void {
    const available = new Set(this.unassigned().map((student) => student.id));
    this.toAssign.setValue([
      ...new Set([...this.toAssign.value, ...ids.filter((id) => available.has(id))]),
    ]);
  }

  /** Takes off the students of a group taken off. */
  removeStudents(ids: readonly string[]): void {
    const gone = new Set(ids);
    this.toAssign.setValue(this.toAssign.value.filter((id) => !gone.has(id)));
  }

  assign(): void {
    const studentIds = this.chosen();
    if (studentIds.length === 0) {
      this.visible.set(false);
      return;
    }
    this.busy
      .guard('assign', this.api.assignStudents(this.assignmentId(), studentIds))
      .subscribe((updated) => {
        this.visible.set(false);
        this.saved.emit(updated);
      });
  }
}
