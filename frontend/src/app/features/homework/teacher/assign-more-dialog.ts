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
import { quietContext } from '@core/http/api-error.interceptor';
import {
  MemberPicker,
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { Busy } from '@shared/ui/busy';
import { SubmitFor } from '@shared/ui/submit-for';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { StudentOption } from './assignment-editor-page';

/** «Выдать ещё ученикам»: one typed student/group selection; students who have the assignment are not offered. */
@Component({
  selector: 'tb-assign-more-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, MemberPicker, SubmitFor],
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
          <label for="assign-students">{{ t.members }}</label>
          <tb-member-picker
            inputId="assign-students"
            [formControl]="members"
            [students]="studentOptions()"
            [groups]="groups()"
          />
        </div>
      </form>
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
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
  readonly members = new FormControl<MemberSelection[]>([], { nonNullable: true });
  /** `ngSubmit` needs a form directive: without it «Выдать» would submit the page. */
  protected readonly form = new FormGroup({ members: this.members });
  /** The groups chosen. */
  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly unassigned = computed(() => {
    const assigned = new Set(this.assigned());
    return this.students().filter((student) => !assigned.has(student.id));
  });
  protected readonly studentOptions = computed(() =>
    this.unassigned().map((student) => ({ id: student.id, name: student.displayName })),
  );
  private readonly chosen = toSignal(this.members.valueChanges, {
    initialValue: this.members.value,
  });

  /** Opens the dialog empty, with the current students. */
  open(): void {
    this.members.setValue([]);
    this.groups.set([]);
    this.identity.listGroups(quietContext()).subscribe((groups) => {
      this.groups.set(groups.filter((group) => group.archivedAt === null));
    });
    this.visible.set(true);
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
  }

  assign(): void {
    const studentIds = memberRecipients(
      this.chosen(),
      this.groups(),
      this.unassigned().map((student) => student.id),
    );
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
