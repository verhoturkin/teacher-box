import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { MemberSelection } from '@features/identity/parts';
import { FieldErrors } from '@shared/ui/field-errors';
import { MarkdownField, MarkdownMode } from '@shared/ui/markdown-field';
import { SectionNav, SectionNavPress } from '@shared/ui/section-nav';
import {
  Attachment,
  AssignmentDetails,
  BoundTextbook,
} from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { QuestionDraft } from '../question-drafts';
import { Course, MAX_VIDEOS, VideoDraft, courseOptions } from '@features/textbooks/parts';
import { EditorBoard, EditorVideos } from './editor-extras';
import { EditorMaterials } from './editor-materials';
import { EditorMaterialsState } from './editor-materials-state';
import { EditorQuizSummary } from './editor-quiz-summary';
import { EditorRecipients } from './editor-recipients';
import { EditorRecipientsState } from './editor-recipients-state';
import { editorAdditions, editorSections } from './editor-sections';

/** The form of the assignment editor: the Markdown text (its first line is the title) and the students. */
export type EditorForm = FormGroup<{
  description: FormControl<string>;
  members: FormControl<MemberSelection[]>;
  /** The course (ADR-0071); `null` — none. */
  courseId: FormControl<string | null>;
}>;

/**
 * «Задание» of the assignment editor (sketch 11): the section menu beside, the text, the videos, the board and
 * the test in the middle, «Кому · Срок» and «Материалы» aside.
 */
@Component({
  selector: 'tb-editor-task',
  imports: [
    ReactiveFormsModule,
    Card,
    Message,
    Select,
    FieldErrors,
    MarkdownField,
    SectionNav,
    EditorBoard,
    EditorMaterials,
    EditorQuizSummary,
    EditorRecipients,
    EditorVideos,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <div class="tb-editor__layout">
      @if (nav()) {
        <tb-section-nav
          class="tb-editor__nav"
          [items]="navItems()"
          [label]="t.sections"
          [actions]="navActions()"
          [actionsLabel]="t.addSection"
          (pressed)="add($event)"
        />
      }
      <form
        tbFieldErrors
        class="tb-editor tb-editor__form tb-form"
        [formGroup]="form()"
        (ngSubmit)="submitted.emit()"
      >
        <div class="tb-editor__columns">
          <div class="tb-editor__main">
            <p-card id="editor-task" styleClass="tb-section-card" class="tb-editor__task">
              <tb-markdown-field
                fieldId="editor-text"
                [control]="form().controls.description"
                [mode]="mode()"
                [label]="c.task"
                [hint]="c.firstLine"
                [(height)]="editorHeight"
              />
            </p-card>

            @if (videos().length > 0 || videoField()) {
              <tb-editor-videos [videos]="videos()" (videosChange)="videosChange.emit($event)" />
            }

            @if (materials().pickedBoard(); as picked) {
              <tb-editor-board
                [title]="picked.title"
                [draft]="draft()"
                (removed)="materials().pickedBoard.set(null)"
              />
            }

            @if (questions().length > 0) {
              <tb-editor-quiz-summary
                [questions]="questions()"
                [attempts]="attempts()"
                (open)="openQuiz.emit()"
              />
            }
            @if (error(); as message) {
              <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
            }
          </div>

          <div class="tb-editor__aside" role="group" [attr.aria-label]="t.params">
            <tb-editor-recipients
              [draft]="draft()"
              [members]="form().controls.members"
              [students]="who().options()"
              [groups]="who().groups()"
              [tasks]="tasks()"
              [lesson]="who().nextLesson()"
              [choice]="who().dueChoice()"
              (choiceChange)="who().chooseDue($event)"
              [date]="who().duePicked()"
              (dateChange)="who().pickDue($event)"
              (more)="more.emit()"
            />

            @if (courses().length > 0) {
              <p-card id="editor-course" styleClass="tb-section-card" [header]="t.course">
                <div class="tb-field">
                  <label for="editor-course-select" class="tb-sr-only">{{ t.course }}</label>
                  <p-select
                    inputId="editor-course-select"
                    formControlName="courseId"
                    [options]="courseChoices()"
                    optionLabel="label"
                    optionValue="value"
                    appendTo="body"
                    [fluid]="true"
                  />
                  <small class="tb-hint">{{ t.courseHint }}</small>
                </div>
              </p-card>
            }

            @if (draft() || extrasInMaterials()) {
              <tb-editor-materials
                [draft]="draft()"
                [extras]="extrasInMaterials()"
                [compact]="compact()"
                [textbooks]="materials().textbooks()"
                [savedFiles]="savedFiles()"
                [videosFull]="videosFull()"
                [boardPicked]="materials().pickedBoard() !== null"
                [(files)]="materials().newFiles"
                (editTextbook)="materials().edit($event)"
                (removeTextbook)="removeTextbook.emit($event)"
                (removeFile)="removeFile.emit($event)"
                (bindTextbook)="materials().bind()"
                (addVideo)="addVideo.emit()"
                (chooseBoard)="chooseBoard.emit($event)"
              />
            }
          </div>
        </div>
      </form>
    </div>
  `,
  styles: `
    .tb-editor {
      min-width: 0;
    }

    .tb-editor__layout {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-gap-section);
    }

    .tb-editor__nav {
      position: sticky;
      inset-block-start: var(--tb-space-4);
      flex: 0 0 12.5rem;
    }

    /*
     * Sketch 11: the text, the videos and the test in the middle, «Кому · Срок» and «Материалы» aside; on a
     * narrow form one column in the order who, the text, the videos, the test, the materials.
     */
    .tb-editor__form {
      flex: 1;
      min-width: 0;
      container: editor-form / inline-size;
    }

    .tb-editor__columns {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    .tb-editor__main,
    .tb-editor__aside {
      display: contents;
    }

    @container editor-form (width >= 52rem) {
      .tb-editor__columns {
        flex-direction: row;
        align-items: flex-start;
        gap: var(--tb-gap-section);
      }

      .tb-editor__main,
      .tb-editor__aside {
        display: flex;
        flex-direction: column;
        gap: var(--tb-space-4);
        min-width: 0;
      }

      .tb-editor__main {
        flex: 1;
      }

      .tb-editor__aside {
        flex: 0 1 23.75rem;
        min-width: 18.75rem;
      }
    }
  `,
})
export class EditorTask {
  protected readonly t = T.editor;
  protected readonly c = T.create;

  readonly form = input.required<EditorForm>();
  readonly mode = input.required<FormControl<MarkdownMode>>();
  /** A new assignment or a saved draft. */
  readonly draft = input.required<boolean>();
  readonly compact = input.required<boolean>();
  /** The section menu is shown (not on a tablet, not beside the assistant). */
  readonly nav = input.required<boolean>();
  /** The students who have the assignment. */
  readonly tasks = input.required<AssignmentDetails['tasks']>();
  readonly savedFiles = input.required<readonly Attachment[]>();
  readonly videos = input.required<readonly VideoDraft[]>();
  /** The chip «Видео» shows the link field even before the first video. */
  readonly videoField = input.required<boolean>();
  readonly questions = input.required<readonly QuestionDraft[]>();
  readonly attempts = input.required<number>();
  readonly error = input.required<string | null>();
  readonly who = input.required<EditorRecipientsState>();
  readonly materials = input.required<EditorMaterialsState>();
  /** The teacher's courses: «Курс» of the assignment (ADR-0071); none — no card. */
  readonly courses = input<readonly Course[]>([]);
  protected readonly courseChoices = computed(() => courseOptions(this.courses()));

  readonly submitted = output();
  readonly videosChange = output<readonly VideoDraft[]>();
  readonly openQuiz = output();
  /** «Выдать ещё». */
  readonly more = output();
  readonly removeTextbook = output<BoundTextbook>();
  readonly removeFile = output<Attachment>();
  readonly addVideo = output();
  readonly chooseBoard = output<Event>();

  /** The height of the text field, kept while the preview is shown so switching never moves the page. */
  readonly editorHeight = model<number | null>(null);
  private readonly videosCard = viewChild(EditorVideos);

  protected readonly navItems = computed(() =>
    editorSections({
      videos: this.videos().length,
      videoField: this.videoField(),
      board: this.materials().pickedBoard() !== null,
      questions: this.questions().length,
    }),
  );
  protected readonly navActions = computed(() =>
    editorAdditions(this.videosFull(), this.materials().pickedBoard() !== null),
  );
  /** No section menu (a tablet, the assistant open): «Видео» and «Доска» are chips of the materials; a phone has neither. */
  protected readonly extrasInMaterials = computed(() => !this.nav() && !this.compact());
  protected readonly videosFull = computed(() => this.videos().length >= MAX_VIDEOS);

  /** «Видео» of the materials or the section menu: the link field takes the focus. */
  focusLink(): void {
    this.videosCard()?.focusLink();
  }

  protected add({ id, event }: SectionNavPress): void {
    if (id === 'video') this.addVideo.emit();
    else this.chooseBoard.emit(event);
  }
}
