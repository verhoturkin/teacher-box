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
import { Observable } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import {
  MemberPicker,
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { StudentOption } from './assignment-editor-page';

/** «Выдать ещё ученикам»: one typed student/group selection; students who have the assignment are not offered. */
@Component({
  selector: 'tb-assign-more-dialog',
  imports: [ReactiveFormsModule, TbDialog, MemberPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      width="wide"
      [(visible)]="visible"
      [headline]="t.assignMore"
      [confirmLabel]="t.assign"
      formId="assign-more-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
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
    </tb-dialog>
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
  protected readonly t = T.page;
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

  /** Opens the dialog with the current students; `studentId` is chosen at once (a cell of the journal). */
  open(studentId?: string): void {
    this.members.setValue(studentId === undefined ? [] : [{ kind: 'STUDENT', id: studentId }]);
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
    if (this.recipients().length === 0) {
      this.visible.set(false);
      return;
    }
    this.submit.run();
  }

  private recipients(): string[] {
    return memberRecipients(
      this.chosen(),
      this.groups(),
      this.unassigned().map((student) => student.id),
    );
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    // `open()` fills the form; the dialog must not clear it again.
    reset: () => undefined,
    failed: T.page.assignFailed,
    request: (): Observable<AssignmentDetails> =>
      this.api.assignStudents(this.assignmentId(), this.recipients()),
    done: (updated) => {
      this.saved.emit(updated);
    },
  });
}
