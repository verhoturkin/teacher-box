import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, of, switchMap } from 'rxjs';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Course, CoursesApi, courseOptions } from '@features/textbooks/parts';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { ChipColors, IdentityApi, Student, StudentGroup } from '@features/identity/parts';
import { T } from '../i18n/texts';

/**
 * Creates a group: its name, the students in it and its current course (ADR-0071). The rest — the price, the default topic, the colour, the
 * room — is on the Профиль tab of the group's card, which the page opens next (redesign spec §8).
 */
@Component({
  selector: 'tb-group-form-dialog',
  imports: [ReactiveFormsModule, TbDialog, InputText, MultiSelect, Select, FieldErrors, ChipColors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (built()) {
      <tb-dialog
        kind="form"
        [(visible)]="visible"
        [headline]="t.newGroup"
        [confirmLabel]="t.create"
        formId="group-form"
        [pending]="submit.pending()"
        [error]="submit.error()"
        [dirty]="submit.dirty()"
      >
        <form
          tbFieldErrors
          id="group-form"
          class="tb-form"
          [formGroup]="form"
          (ngSubmit)="submit.run()"
        >
          <div class="tb-field">
            <label for="group-name">{{ t.name }}</label>
            <input
              pInputText
              id="group-name"
              formControlName="name"
              autocomplete="off"
              [placeholder]="t.namePlaceholder"
            />
          </div>
          <div class="tb-field">
            <label for="group-members">{{ t.members }}</label>
            <p-multiselect
              inputId="group-members"
              formControlName="memberIds"
              [options]="memberOptions()"
              optionLabel="displayName"
              optionValue="id"
              [placeholder]="t.membersPlaceholder"
              [filter]="true"
              [filterPlaceHolder]="t.search"
              [ariaFilterLabel]="t.search"
              display="chip"
              tbChipColors="student"
              appendTo="body"
              [fluid]="true"
            />
          </div>
          @if (courses().length > 0) {
            <div class="tb-field">
              <label for="group-course">{{ t.course }}</label>
              <p-select
                inputId="group-course"
                formControlName="courseId"
                [options]="courseChoices()"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          }
        </form>
      </tb-dialog>
    }
  `,
})
export class GroupFormDialog {
  protected readonly t = T.groupForm;
  private readonly api = inject(IdentityApi);
  private readonly coursesApi = inject(CoursesApi);

  readonly visible = model(false);
  /** Built when first opened (`openedOnce`): hidden, its form is not built with the page. */
  protected readonly built = openedOnce(this.visible);
  /** Students that can join (deactivated ones are skipped). */
  readonly students = input<readonly Student[]>([]);
  /** The teacher's courses: the group's current course (ADR-0071); none — no «Курс» field. */
  readonly courses = input<readonly Course[]>([]);
  /** The new group and the course it was given (`null` — none). */
  readonly created = output<{ group: StudentGroup; courseId: string | null }>();

  readonly memberOptions = computed(() =>
    this.students().filter((student) => student.status !== 'DEACTIVATED'),
  );

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    memberIds: [[] as string[]],
    courseId: [null as string | null],
  });
  protected readonly courseChoices = computed(() => courseOptions(this.courses()));

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.groupForm.failed,
    request: (value) =>
      this.api
        .createGroup({
          name: value.name.trim(),
          memberIds: value.memberIds,
          defaultTopic: null,
          color: null,
        })
        .pipe(
          switchMap((group) =>
            value.courseId === null
              ? of({ group, courseId: null })
              : // a refused course (a toast) does not undo the group: it is chosen again in Профиль
                this.coursesApi.setGroupCourse(group.id, value.courseId).pipe(
                  map(() => ({ group, courseId: value.courseId })),
                  catchError(() => of({ group, courseId: null })),
                ),
          ),
        ),
    done: (created) => {
      this.created.emit(created);
    },
  });
}
