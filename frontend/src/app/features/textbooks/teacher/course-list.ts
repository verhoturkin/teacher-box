import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Params, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { Busy } from '@shared/ui/busy';
import { Confirm } from '@shared/ui/confirm';
import { arrowStep, reordered } from '@shared/ui/reorder';
import { CoursesApi } from '../data-access/courses-api';
import { Course } from '../data-access/courses.models';
import { T } from '../i18n/texts';

/** The longest course name (`textbooks.courses.name`). */
const MAX_NAME = 100;

/**
 * The teacher's courses as rows of the list pane of «Материалы» (ADR-0071, roadmap 11 decision 9): each row
 * links to the course (`queryParams`), shows how many materials it has and keeps its actions in «⋮» —
 * «Переименовать» (in place: Enter saves, Esc cancels), «Выше» / «Ниже» (the single-pointer alternative to the
 * drag, M3) and «Удалить…» (danger confirmation). The trailing handle drags the row into order (↑ ↓ on it
 * too, as the quiz and the videos); the last row «+ Новый курс» turns into a field. Every change is
 * saved at once. The host is one `tb-list` of a `tb-list-group`: the page puts its own rows before and after.
 */
@Component({
  selector: 'tb-course-list',
  imports: [
    ButtonAttributes,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    ReactiveFormsModule,
    RouterLink,
    Button,
    InputText,
    Menu,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="tb-list tb-course-list"
      cdkDropList
      cdkDropListLockAxis="y"
      [attr.aria-label]="t.title"
      (cdkDropListDropped)="drop($event)"
    >
      @for (course of courses(); track course.id) {
        <li
          cdkDrag
          [cdkDragDisabled]="editing() !== null"
          [class.tb-list__item--current]="course.id === current()"
        >
          <span class="tb-list__lead" aria-hidden="true"
            ><i class="tb-i tb-i-collections_bookmark"></i
          ></span>
          @if (editing() === course.id) {
            <form class="tb-list__text" (submit)="submitted($event); rename(course)">
              <input
                #nameField
                pInputText
                class="tb-course-list__field"
                [formControl]="renameControl"
                [attr.aria-label]="t.renameLabel(course.name)"
                [maxlength]="maxName"
                autocomplete="off"
                (keydown.escape)="cancel($event)"
              />
            </form>
            <span class="tb-list__trail tb-list__trail--icons">
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
            <div class="tb-list__text">
              <a
                class="tb-list__title tb-list__link"
                [routerLink]="[]"
                [queryParams]="queryParams()(course.id)"
                [attr.aria-current]="course.id === current() ? 'page' : null"
                >{{ course.name
                }}<span class="tb-sr-only">, {{ t.count(countOf(course)) }}</span></a
              >
            </div>
            <span class="tb-list__trail tb-list__trail--icons">
              <span class="tb-course-list__count" aria-hidden="true">{{ countOf(course) }}</span>
              <p-button
                icon="tb-i tb-i-more_vert"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                [ariaLabel]="t.actions(course.name)"
                [loading]="busy.is('remove:' + course.id)"
                [tbAttributes]="{
                  'aria-haspopup': 'menu',
                  'aria-expanded': menuFor()?.id === course.id ? 'true' : 'false',
                }"
                (onClick)="openMenu(course, $event)"
              />
              <button
                type="button"
                class="tb-drag-handle"
                cdkDragHandle
                [attr.aria-label]="t.drag(course.name)"
                (keydown)="keyMove($event, course)"
              >
                <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
              </button>
            </span>
          }
        </li>
      }
      <li>
        <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-add"></i></span>
        @if (adding()) {
          <form class="tb-list__text" (submit)="submitted($event); add()">
            <input
              #nameField
              pInputText
              class="tb-course-list__field"
              [formControl]="nameControl"
              [attr.aria-label]="t.newCourse"
              [placeholder]="t.newCoursePlaceholder"
              [maxlength]="maxName"
              autocomplete="off"
              (keydown.escape)="cancel($event)"
              (blur)="leaveAdd()"
            />
          </form>
          <span class="tb-list__trail tb-list__trail--icons">
            <p-button
              icon="tb-i tb-i-check"
              [text]="true"
              [rounded]="true"
              [ariaLabel]="c.add"
              [loading]="busy.is('add')"
              (onClick)="add()"
            />
          </span>
        } @else {
          <div class="tb-list__text">
            <button type="button" class="tb-list__title tb-list__link" (click)="startAdd()">
              {{ t.newCourse }}
            </button>
          </div>
        }
      </li>
    </ul>
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-course-list > li.cdk-drag-preview {
      box-shadow: var(--tb-elevation-2);
    }

    .tb-course-list > li.cdk-drag-placeholder {
      opacity: 0.4;
    }

    .tb-course-list .tb-list__trail {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
    }

    /* M3 list trailing text: label small, on-surface-variant */
    .tb-course-list__count {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-s);
      letter-spacing: var(--tb-tracking-label-s);
    }

    .tb-list__item--current .tb-course-list__count {
      color: inherit;
    }

    .tb-course-list__field {
      inline-size: 100%;
      min-inline-size: 0;
    }

    button.tb-list__link {
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-align: start;
      cursor: pointer;
    }
  `,
})
export class CourseList {
  protected readonly t = T.courses;
  protected readonly c = SHARED_T.common;
  protected readonly maxName = MAX_NAME;
  private readonly api = inject(CoursesApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);
  private readonly injector = inject(Injector);
  protected readonly busy = new Busy();

  /** The teacher's courses in their order: the page gives them and hears every change. */
  readonly courses = model<readonly Course[]>([]);
  /** The id of the course open beside the list; none — another row is. */
  readonly current = input<string | null>(null);
  /** How many materials each course has, by its id. */
  readonly counts = input<ReadonlyMap<string, number>>(new Map());
  /** The query parameters of the page that open a course. */
  readonly queryParams = input.required<(courseId: string) => Params>();
  /** A course was renamed or deleted: the materials of the page show another course now. */
  readonly changed = output();

  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly renameControl = new FormControl('', { nonNullable: true });
  /** The course being renamed in place. */
  protected readonly editing = signal<string | null>(null);
  /** «+ Новый курс» is a field. */
  protected readonly adding = signal(false);
  private readonly nameField = viewChild<ElementRef<HTMLInputElement>>('nameField');

  /** The course whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<Course | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const course = this.menuFor();
    return course === null ? [] : this.actionsOf(course);
  });
  private readonly menu = viewChild.required<Menu>('menu');

  protected countOf(course: Course): number {
    return this.counts().get(course.id) ?? 0;
  }

  /** A plain form (no form group): Enter saves, the page is not reloaded. */
  protected submitted(event: Event): void {
    event.preventDefault();
  }

  protected openMenu(course: Course, event: Event): void {
    this.menuFor.set(course);
    this.menu().toggle(event);
  }

  protected startAdd(): void {
    this.editing.set(null);
    this.nameControl.reset();
    this.adding.set(true);
    this.focusField();
  }

  /** Leaving an empty field closes it; a typed name stays until Enter or Esc. */
  protected leaveAdd(): void {
    if (this.nameControl.value.trim() === '' && !this.busy.is('add')) {
      this.adding.set(false);
    }
  }

  protected add(): void {
    const name = this.nameControl.value.trim();
    if (name === '') {
      this.adding.set(false);
      return;
    }
    this.busy.guard('add', this.api.create(name)).subscribe((course) => {
      this.courses.update((list) => [...list, course]);
      this.nameControl.reset();
      this.adding.set(false);
      this.snackbar.success(this.t.added(course.name));
    });
  }

  /** Esc closes the field, not a dialog or a sheet around the list. */
  protected cancel(event: Event): void {
    event.stopPropagation();
    this.editing.set(null);
    this.adding.set(false);
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
      this.changed.emit();
    });
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

  private startRename(course: Course): void {
    this.adding.set(false);
    this.renameControl.setValue(course.name);
    this.editing.set(course.id);
    this.focusField();
  }

  private focusField(): void {
    afterNextRender(() => this.nameField()?.nativeElement.focus(), { injector: this.injector });
  }

  private async confirmRemove(course: Course): Promise<void> {
    if (
      await this.confirm.danger({
        header: this.t.deleteHeader,
        message: this.t.deleteMessage(course.name),
        acceptLabel: this.c.delete,
      })
    ) {
      this.busy.guard(`remove:${course.id}`, this.api.remove(course.id)).subscribe(() => {
        this.courses.update((list) => list.filter((entry) => entry.id !== course.id));
        this.changed.emit();
        this.snackbar.success(this.t.deleted(course.name));
      });
    }
  }

  private actionsOf(course: Course): MenuItem[] {
    const index = this.courses().findIndex((entry) => entry.id === course.id);
    return [
      {
        label: this.t.rename,
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.startRename(course);
        },
      },
      {
        label: this.t.moveUp,
        icon: 'tb-i tb-i-arrow_upward',
        disabled: index <= 0,
        command: () => {
          this.move(index, index - 1);
        },
      },
      {
        label: this.t.moveDown,
        icon: 'tb-i tb-i-arrow_downward',
        disabled: index >= this.courses().length - 1,
        command: () => {
          this.move(index, index + 1);
        },
      },
      {
        label: this.t.delete,
        icon: 'tb-i tb-i-delete',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          void this.confirmRemove(course);
        },
      },
    ];
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
