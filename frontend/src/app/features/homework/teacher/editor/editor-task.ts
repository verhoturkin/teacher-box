import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { MemberSelection } from '@features/identity/parts';
import { FieldErrors } from '@shared/ui/field-errors';
import { MarkdownView } from '@shared/ui/markdown-view';
import { SectionNav, SectionNavPress } from '@shared/ui/section-nav';
import {
  Attachment,
  AssignmentDetails,
  BoundTextbook,
} from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { QuestionDraft } from '../question-drafts';
import { MAX_VIDEOS, VideoDraft } from '../video-section';
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
}>;

/** «Писать» or «Просмотр» of the text. */
export type EditorMode = 'edit' | 'preview';

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
    SelectButton,
    Textarea,
    FieldErrors,
    MarkdownView,
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
              <div class="tb-field">
                <div class="tb-field__header">
                  <label for="editor-text">{{ c.task }}</label>
                  <p-selectbutton
                    [options]="modes"
                    [formControl]="mode()"
                    optionLabel="label"
                    optionValue="value"
                    [allowEmpty]="false"
                    [ariaLabel]="t.editorMode"
                  />
                </div>
                @if (modeValue() === 'preview') {
                  <div class="tb-preview" [style.min-height.px]="editorHeight()">
                    <tb-markdown [text]="text()" />
                  </div>
                } @else {
                  <textarea
                    pTextarea
                    id="editor-text"
                    class="tb-editor__text"
                    #editor
                    [style.height.px]="editorHeight()"
                    formControlName="description"
                    rows="10"
                  ></textarea>
                }
                <small class="tb-hint">{{ c.firstLine }}. {{ t.markdownHint }}</small>
              </div>
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
      gap: var(--tb-space-6);
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
        gap: var(--tb-space-6);
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

    .tb-editor__text {
      width: 100%;
    }
  `,
})
export class EditorTask implements OnInit {
  protected readonly t = T.editor;
  protected readonly c = T.create;
  private readonly destroyRef = inject(DestroyRef);

  readonly form = input.required<EditorForm>();
  readonly mode = input.required<FormControl<EditorMode>>();
  /** The text as it is typed. */
  readonly text = input.required<string>();
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

  readonly submitted = output();
  readonly videosChange = output<readonly VideoDraft[]>();
  readonly openQuiz = output();
  /** «Выдать ещё». */
  readonly more = output();
  readonly removeTextbook = output<BoundTextbook>();
  readonly removeFile = output<Attachment>();
  readonly addVideo = output();
  readonly chooseBoard = output<Event>();

  protected readonly modes = [
    { label: T.editor.write, value: 'edit' },
    { label: T.editor.preview, value: 'preview' },
  ];
  protected readonly modeValue = signal<EditorMode>('edit');
  /** The height of the text field, kept while the preview is shown so switching never moves the page. */
  readonly editorHeight = model<number | null>(null);
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
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

  ngOnInit(): void {
    const mode = this.mode();
    this.modeValue.set(mode.value);
    mode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const field = this.editor();
      if (field) {
        this.editorHeight.set(field.nativeElement.offsetHeight);
      }
      this.modeValue.set(value);
    });
  }

  /** «Видео» of the materials or the section menu: the link field takes the focus. */
  focusLink(): void {
    this.videosCard()?.focusLink();
  }

  protected add({ id, event }: SectionNavPress): void {
    if (id === 'video') this.addVideo.emit();
    else this.chooseBoard.emit(event);
  }
}
