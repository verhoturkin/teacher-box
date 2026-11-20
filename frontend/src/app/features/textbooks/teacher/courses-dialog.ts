import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  Injector,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';
import { Busy } from '@shared/ui/busy';
import { Confirm } from '@shared/ui/confirm';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { arrowStep, reordered } from '@shared/ui/reorder';
import { CoursesApi } from '../data-access/courses-api';
import { Course } from '../data-access/courses.models';
import { T } from '../i18n/texts';

/** The longest course name (`textbooks.courses.name`). */
const MAX_NAME = 100;

/**
 * «Курсы» (ADR-0071), opened from the «⋮» of the course filter of «Материалы»: the teacher's courses as
 * a segmented list — dragged (or moved with the arrow keys on the handle) into order, renamed in place
 * (✎), deleted after a danger confirmation; the field under the list adds one. A `sheet`: the list and
 * its actions, every change is saved at once (no «Сохранить»).
 */
@Component({
  selector: 'tb-courses-dialog',
  imports: [CdkDrag, CdkDragHandle, CdkDropList, ReactiveFormsModule, Button, InputText, TbDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (built()) {
      <tb-dialog kind="sheet" [(visible)]="visible" [headline]="t.title" [cancelLabel]="c.close">
        <p class="tb-courses__intro">{{ t.intro }}</p>
        @if (courses().length > 0) {
          <ul
            class="tb-list tb-courses__list"
            cdkDropList
            [attr.aria-label]="t.title"
            (cdkDropListDropped)="drop($event)"
          >
            @for (course of courses(); track course.id) {
              <li cdkDrag [cdkDragDisabled]="editing() !== null">
                <button
                  type="button"
                  class="tb-list__lead tb-drag-handle"
                  cdkDragHandle
                  [attr.aria-label]="t.drag(course.name)"
                  (keydown)="keyMove($event, course)"
                >
                  <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
                </button>
                @if (editing() === course.id) {
                  <form
                    class="tb-list__text tb-courses__rename"
                    (submit)="submitted($event); rename(course)"
                  >
                    <input
                      #renameField
                      pInputText
                      class="tb-courses__field"
                      [formControl]="renameControl"
                      [attr.aria-label]="t.renameLabel(course.name)"
                      [maxlength]="maxName"
                      autocomplete="off"
                      (keydown.escape)="cancelRename($event)"
                    />
                  </form>
                  <span class="tb-list__trail">
                    <p-button
                      icon="tb-i tb-i-check"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="c.save"
                      [loading]="busy.is('rename')"
                      (onClick)="rename(course)"
                    />
                    <p-button
                      icon="tb-i tb-i-close"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="c.cancel"
                      (onClick)="editing.set(null)"
                    />
                  </span>
                } @else {
                  <span class="tb-list__text">
                    <span class="tb-list__title">{{ course.name }}</span>
                  </span>
                  <span class="tb-list__trail">
                    <p-button
                      icon="tb-i tb-i-edit"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="t.rename(course.name)"
                      (onClick)="startRename(course)"
                    />
                    <p-button
                      icon="tb-i tb-i-delete"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="t.delete(course.name)"
                      [loading]="busy.is('remove:' + course.id)"
                      (onClick)="confirmRemove(course)"
                    />
                  </span>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="tb-courses__empty">{{ t.empty }}</p>
        }
        <form class="tb-courses__add" (submit)="submitted($event); add()">
          <input
            pInputText
            class="tb-courses__field"
            [formControl]="nameControl"
            [attr.aria-label]="t.newCourse"
            [placeholder]="t.newCoursePlaceholder"
            [maxlength]="maxName"
            autocomplete="off"
          />
          <p-button
            icon="tb-i tb-i-add"
            severity="secondary"
            [label]="c.add"
            [loading]="busy.is('add')"
            (onClick)="add()"
          />
        </form>
      </tb-dialog>
    }
  `,
  styles: `
    .tb-courses__intro,
    .tb-courses__empty {
      margin: 0 0 var(--tb-space-3);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      letter-spacing: var(--tb-tracking-body-m);
    }

    .tb-courses__list {
      margin-block-end: var(--tb-space-4);
    }

    .tb-courses__list > li {
      padding-inline-start: var(--tb-space-1);
    }

    .tb-courses__list > li.cdk-drag-preview {
      box-shadow: var(--tb-elevation-2);
    }

    .tb-courses__list > li.cdk-drag-placeholder {
      opacity: 0.4;
    }

    .tb-courses__list .tb-list__trail {
      display: flex;
      gap: var(--tb-space-1);
    }

    .tb-courses__rename {
      display: flex;
      min-width: 0;
    }

    .tb-courses__add {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-courses__field {
      flex: 1 1 auto;
      min-width: 0;
    }
  `,
})
export class CoursesDialog {
  protected readonly t = T.courses;
  protected readonly c = SHARED_T.common;
  protected readonly maxName = MAX_NAME;
  private readonly api = inject(CoursesApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly injector = inject(Injector);
  protected readonly busy = new Busy();

  readonly visible = model(false);
  protected readonly built = openedOnce(this.visible);
  /** The teacher's courses in their order: the page gives them and hears every change. */
  readonly courses = model<readonly Course[]>([]);
  /** A course was deleted: its textbooks, students and groups are now without a course. */
  readonly removed = output<Course>();

  protected readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(MAX_NAME)],
  });
  protected readonly renameControl = new FormControl('', { nonNullable: true });
  /** The course being renamed in place. */
  protected readonly editing = signal<string | null>(null);
  private readonly renameField = viewChild<ElementRef<HTMLInputElement>>('renameField');

  /** A plain form (no form group): Enter saves, the page is not reloaded. */
  protected submitted(event: Event): void {
    event.preventDefault();
  }

  protected add(): void {
    const name = this.nameControl.value.trim();
    if (name === '') {
      return;
    }
    this.busy.guard('add', this.api.create(name)).subscribe((course) => {
      this.courses.update((list) => [...list, course]);
      this.nameControl.reset();
      this.snackbar.success(this.t.added(course.name));
    });
  }

  protected startRename(course: Course): void {
    this.renameControl.setValue(course.name);
    this.editing.set(course.id);
    afterNextRender(() => this.renameField()?.nativeElement.focus(), { injector: this.injector });
  }

  protected cancelRename(event: Event): void {
    // Escape closes the rename, not the dialog
    event.stopPropagation();
    this.editing.set(null);
  }

  protected rename(course: Course): void {
    const name = this.renameControl.value.trim();
    if (name === '' || name === course.name) {
      this.editing.set(null);
      return;
    }
    this.busy.guard('rename', this.api.rename(course, name)).subscribe((renamed) => {
      this.courses.update((list) =>
        list.map((entry) => (entry.id === renamed.id ? renamed : entry)),
      );
      this.editing.set(null);
    });
  }

  protected async confirmRemove(course: Course): Promise<void> {
    if (
      await this.confirm.danger({
        header: this.t.deleteHeader,
        message: this.t.deleteMessage(course.name),
        acceptLabel: this.c.delete,
      })
    ) {
      this.busy.guard(`remove:${course.id}`, this.api.remove(course.id)).subscribe(() => {
        this.courses.update((list) => list.filter((entry) => entry.id !== course.id));
        this.removed.emit(course);
        this.snackbar.success(this.t.deleted(course.name));
      });
    }
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** The arrow keys on a handle move the course; the focus stays on its handle. */
  protected keyMove(event: KeyboardEvent, course: Course): void {
    const step = arrowStep(event);
    if (step !== null) {
      event.preventDefault();
      const from = this.courses().findIndex((entry) => entry.id === course.id);
      this.move(from, from + step);
    }
  }

  private move(from: number, to: number): void {
    const before = this.courses();
    if (from === to || to < 0 || to >= before.length) {
      return;
    }
    const list = reordered(before, from, to);
    this.courses.set(list);
    this.api.reorder(list.map((course) => course.id)).subscribe({
      next: (saved) => {
        this.courses.set(saved);
      },
      error: () => {
        this.courses.set(before);
      },
    });
  }
}
