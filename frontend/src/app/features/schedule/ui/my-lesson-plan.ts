import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { TextbookList, boundTextbookFilename } from '@features/homework/parts';
import { PickedTextbook, VideoList } from '@features/textbooks/parts';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson, StudentLessonPlan } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/**
 * Student and parent: «План урока» of the lesson card, read-only (roadmap 11 «Lesson card»): the text, the
 * textbook pages to open or save and the videos with the player — a transcript only when the teacher shows it.
 * The addresses follow the cabinet (`API_SCOPE`): the student's own or a child's in the family cabinet.
 */
@Component({
  selector: 'tb-my-lesson-plan',
  imports: [LoadStateView, MarkdownView, TextbookList, VideoList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lesson().planId !== null) {
      <section class="tb-my-lesson-plan" [attr.aria-label]="t.title">
        <h3 class="tb-my-lesson-plan__title">{{ t.title }}</h3>
        <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
          @if (plan(); as item) {
            <p class="tb-strong tb-my-lesson-plan__name">{{ item.title }}</p>
            @if (item.body.trim() !== '') {
              <tb-markdown [text]="item.body" />
            }
            @if (textbooks().length > 0) {
              <h4 class="tb-my-lesson-plan__label">{{ t.textbooks }}</h4>
              <tb-textbook-list
                [textbooks]="textbooks()"
                [downloadable]="true"
                (opened)="openTextbook($event)"
                (download)="downloadTextbook($event)"
              />
            }
            @if (item.videos.length > 0) {
              <h4 class="tb-my-lesson-plan__label">{{ t.videos }}</h4>
              <tb-video-list [videos]="item.videos" />
            }
          }
        </tb-load-state>
      </section>
    }
  `,
  styles: `
    .tb-my-lesson-plan {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }

    .tb-my-lesson-plan__title {
      margin: var(--tb-space-2) 0 0;
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
    }

    .tb-my-lesson-plan__name {
      margin: 0;
    }

    .tb-my-lesson-plan__label {
      margin: var(--tb-space-2) 0 0;
      font: var(--tb-type-title-s);
      letter-spacing: var(--tb-tracking-title-s);
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class MyLessonPlan {
  protected readonly t = T.lessonPlan;
  private readonly api = inject(ScheduleApi);
  private readonly fileOpener = inject(FileOpener);
  private readonly fileSaver = inject(FileSaver);

  readonly lesson = input.required<ScheduledLesson>();

  protected readonly state = new LoadState();
  protected readonly plan = signal<StudentLessonPlan | null>(null);
  /** The plan's textbooks as the homework list shows them. */
  protected readonly textbooks = computed<PickedTextbook[]>(() =>
    (this.plan()?.textbooks ?? []).map((textbook) => ({
      textbookId: textbook.id,
      kind: textbook.kind,
      title: textbook.title,
      courseName: null,
      format: textbook.format,
      pageCount: null,
      pages: textbook.pages,
    })),
  );

  /** The lesson and the plan last loaded. */
  private loaded: string | null = null;

  constructor() {
    effect(() => {
      const lesson = this.lesson();
      const key = lesson.planId === null ? null : `${lesson.id}:${lesson.planId}`;
      untracked(() => {
        if (key === null) {
          this.plan.set(null);
        } else if (key !== this.loaded) {
          this.load();
        }
      });
    });
  }

  protected load(): void {
    const lesson = this.lesson();
    if (lesson.planId === null) {
      return;
    }
    this.loaded = `${lesson.id}:${lesson.planId}`;
    this.api
      .myPlan(lesson.id)
      .pipe(this.state.track())
      .subscribe((plan) => {
        this.plan.set(plan);
      });
  }

  /** The bound pages of a PDF or a picture open in a new tab; a Word file is saved. */
  protected openTextbook(textbook: PickedTextbook): void {
    this.fileOpener.open(
      this.api.myPlanTextbook(this.lesson().id, textbook.textbookId),
      textbook.format !== 'DOCUMENT',
      (blob) => boundTextbookFilename(textbook, blob.type),
    );
  }

  protected downloadTextbook(textbook: PickedTextbook): void {
    this.api.myPlanTextbook(this.lesson().id, textbook.textbookId).subscribe((blob) => {
      this.fileSaver.save(blob, boundTextbookFilename(textbook, blob.type));
    });
  }
}
