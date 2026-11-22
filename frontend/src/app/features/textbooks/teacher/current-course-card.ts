import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { Select } from 'primeng/select';
import { Observable } from 'rxjs';
import { Busy } from '@shared/ui/busy';
import { CoursesApi } from '../data-access/courses-api';
import { Course } from '../data-access/courses.models';
import { courseOptions } from '../course-options';
import { T } from '../i18n/texts';

/** Whose current course the card sets. */
export interface CourseOwner {
  readonly kind: 'STUDENT' | 'GROUP';
  readonly id: string;
}

/**
 * «Курс» of the Профиль tab of a student's or a group's card (ADR-0071): the one current course,
 * saved as soon as it is chosen (as the colour of the label); a refused choice goes back. A former
 * student or an archived group keeps the course but takes no new one.
 */
@Component({
  selector: 'tb-current-course-card',
  imports: [FormsModule, Card, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <div class="tb-form">
        <div class="tb-field">
          <label [for]="inputId()">{{ t.label }}</label>
          <p-select
            [inputId]="inputId()"
            [options]="options()"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [fluid]="true"
            [disabled]="disabled() || busy.any()"
            [loading]="busy.any()"
            [ngModel]="chosen()"
            (ngModelChange)="choose($event)"
          />
          <small class="tb-hint">{{
            owner().kind === 'STUDENT' ? t.studentHint : t.groupHint
          }}</small>
        </div>
      </div>
    </p-card>
  `,
})
export class CurrentCourseCard {
  protected readonly t = T.current;
  private readonly api = inject(CoursesApi);
  protected readonly busy = new Busy();

  readonly owner = input.required<CourseOwner>();
  /** The teacher's courses in their order. */
  readonly courses = input<readonly Course[]>([]);
  /** The current course; `null` — none. */
  readonly courseId = input<string | null>(null);
  readonly disabled = input(false);
  /** The course was saved: the page shows it in the card header. */
  readonly changed = output<string | null>();

  protected readonly inputId = computed(() => `course-${this.owner().id}`);
  protected readonly options = computed(() => courseOptions(this.courses()));
  protected readonly chosen = linkedSignal(() => this.courseId());

  protected choose(courseId: string | null): void {
    const before = this.chosen();
    if (courseId === before) {
      return;
    }
    this.chosen.set(courseId);
    this.busy.guard('save', this.save(courseId)).subscribe({
      next: () => {
        this.changed.emit(courseId);
      },
      error: () => {
        this.chosen.set(before);
      },
    });
  }

  private save(courseId: string | null): Observable<void> {
    const owner = this.owner();
    return owner.kind === 'STUDENT'
      ? this.api.setStudentCourse(owner.id, courseId)
      : this.api.setGroupCourse(owner.id, courseId);
  }
}
