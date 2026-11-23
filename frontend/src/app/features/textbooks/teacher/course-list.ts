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

let lists = 0;

/** The longest course name (`textbooks.courses.name`). */
const MAX_NAME = 100;

/**
 * The teacher's courses as items of the navigation menu of «Материалы» (`tb-nav-menu`, ADR-0071
 * decision 9, 466.4): the headline «Курсы», then each course — the drag handle, the icon, the name linked to
 * the course (`queryParams`), how many materials it has and «⋮» with «Переименовать» (in place: Enter
 * saves, Esc cancels), «Выше» / «Ниже» (the single-pointer alternative to the drag, M3) and «Удалить…»
 * (danger confirmation). The handle drags the course into order (↑ ↓ on it too, as the quiz and the
 * videos); the last item «+ Новый курс» turns into a field. Every change is saved at once. The host is a
 * group of the page's `nav.tb-nav-menu`: the page puts its own items before and after.
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
    <span class="tb-nav-menu__headline" [id]="headlineId" aria-hidden="true">{{ t.title }}</span>
    <ul
      class="tb-nav-menu__list tb-course-list"
      cdkDropList
      cdkDropListLockAxis="y"
      [attr.aria-labelledby]="headlineId"
      (cdkDropListDropped)="drop($event)"
    >
      @for (course of courses(); track course.id) {
        <li
          class="tb-nav-menu__item"
          cdkDrag
          [cdkDragDisabled]="editing() !== null"
          [class.tb-nav-menu__item--current]="course.id === current()"
        >
          @if (editing() === course.id) {
            <i class="tb-i tb-i-collections_bookmark" aria-hidden="true"></i>
            <form class="tb-course-list__form" (submit)="submitted($event); rename(course)">
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
          } @else {
            @if (!touch()) {
              <button
                type="button"
                class="tb-drag-handle"
                cdkDragHandle
                [attr.aria-label]="t.drag(course.name)"
                (keydown)="keyMove($event, course)"
              >
                <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
              </button>
            }
            <i class="tb-i tb-i-collections_bookmark" aria-hidden="true"></i>
            <a
              class="tb-nav-menu__link"
              [routerLink]="[]"
              [queryParams]="queryParams()(course.id)"
              [attr.aria-current]="course.id === current() ? 'page' : null"
              >{{ course.name }}<span class="tb-sr-only">, {{ t.count(countOf(course)) }}</span></a
            >
            <span class="tb-nav-menu__count" aria-hidden="true">{{ countOf(course) }}</span>
            <p-button
              class="tb-nav-menu__more"
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
          }
        </li>
      }
      <li class="tb-nav-menu__item tb-nav-menu__item--action">
        <i class="tb-i tb-i-add" aria-hidden="true"></i>
        @if (adding()) {
          <form class="tb-course-list__form" (submit)="submitted($event); add()">
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
          <p-button
            icon="tb-i tb-i-check"
            [text]="true"
            [rounded]="true"
            [ariaLabel]="c.add"
            [loading]="busy.is('add')"
            (onClick)="add()"
          />
        } @else {
          <button type="button" class="tb-nav-menu__link" (click)="startAdd()">
            {{ t.newCourse }}
          </button>
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

    /* the dragged course is lifted off the menu: a surface of its own (M3 drag: elevation 2) */
    .tb-course-list > li.cdk-drag-preview {
      background: var(--p-md-surface-container-high);
      box-shadow: var(--tb-elevation-2);
    }

    .tb-course-list > li.cdk-drag-placeholder {
      opacity: 0.4;
    }

    .tb-course-list__form {
      display: flex;
      flex: 1 1 auto;
      min-inline-size: 0;
    }

    .tb-course-list__field {
      inline-size: 100%;
      min-inline-size: 0;
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
  protected readonly headlineId = `tb-course-list-${String(++lists)}`;

  /** The teacher's courses in their order: the page gives them and hears every change. */
  readonly courses = model<readonly Course[]>([]);
  /** The id of the course open beside the list; none — another item is. */
  readonly current = input<string | null>(null);
  /** How many materials each course has, by its id. */
  readonly counts = input<ReadonlyMap<string, number>>(new Map());
  /** The query parameters of the page that open a course. */
  readonly queryParams = input.required<(courseId: string) => Params>();
  /**
   * The list screen of a phone (`tb-nav-menu--touch` on the menu): nothing is chosen there, so every «⋮» is
   * shown; no drag handle — «Выше» / «Ниже» in «⋮» move a course (the single-pointer alternative, M3).
   */
  readonly touch = input(false);
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
