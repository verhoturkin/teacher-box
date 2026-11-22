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

let nextId = 0;

/**
 * Student and parent: the plan of the lesson card, read-only (roadmap 11 «Lesson card», decision 13): one row
 * «План: <title>» that opens in place — the text, the textbook pages to open or save and the videos with the
 * player (a transcript only when the teacher shows it).
 * The addresses follow the cabinet (`API_SCOPE`): the student's own or a child's in the family cabinet.
 */
@Component({
  selector: 'tb-my-lesson-plan',
  imports: [LoadStateView, MarkdownView, TextbookList, VideoList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lesson().planId !== null) {
      <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
        <li class="tb-lesson-prep__row" [class.tb-lesson-prep__row--open]="expanded()">
          <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-list_alt"></i></span>
          <div class="tb-list__text">
            <button
              type="button"
              class="tb-list__title tb-list__link tb-lesson-prep__toggle"
              [attr.aria-expanded]="expanded()"
              [attr.aria-controls]="bodyId"
              (click)="expanded.set(!expanded())"
            >
              {{ plan() === null ? t.rowLoading : t.row(plan()?.title ?? '') }}
            </button>
          </div>
          <div class="tb-list__trail tb-list__trail--icons">
            <i class="tb-i tb-i-expand_more tb-lesson-prep__chevron" aria-hidden="true"></i>
          </div>
        </li>
      </ul>
      <!-- the textbooks and the videos are lists of their own: the opened plan lies on the card -->
      @if (expanded()) {
        <div class="tb-my-lesson-plan__body" [id]="bodyId">
          <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
            @if (plan(); as item) {
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
        </div>
      }
    }
  `,
  styleUrl: './lesson-prep.scss',
})
export class MyLessonPlan {
  protected readonly t = T.lessonPlan;
  private readonly api = inject(ScheduleApi);
  private readonly fileOpener = inject(FileOpener);
  private readonly fileSaver = inject(FileSaver);

  readonly lesson = input.required<ScheduledLesson>();

  protected readonly state = new LoadState();
  protected readonly plan = signal<StudentLessonPlan | null>(null);
  /** The row is open. */
  readonly expanded = signal(false);
  protected readonly bodyId = `tb-my-lesson-plan-${String(++nextId)}`;
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
