import { injectWindowSize } from '@core/layout/mobile';
import { Pane, Panes, PaneHeader } from '@shared/ui/panes';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { Drawer } from 'primeng/drawer';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
  Injector,
  DestroyRef,
  effect,
  untracked,
} from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { locale } from '@core/i18n/language';
import { SHARED_T } from '@shared/i18n/texts';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, UrlTree } from '@angular/router';
import { CREATE_PARAM } from '@core/routing/create-param';
import {
  Observable,
  catchError,
  concat,
  defer,
  last,
  map,
  of,
  switchMap,
  tap,
  toArray,
} from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { CanLeave } from '@core/routing/can-leave.guard';
import { pageDetail } from '@core/routing/page-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import {
  AiApi,
  AppliedDraft,
  AppliedQuestions,
  HomeworkAiPanel,
  HomeworkAiState,
  SourceOption,
} from '@features/ai/parts';
import { BoardsApi, Placed, ToBoardDialog } from '@features/boards/parts';
import { quietContext } from '@core/http/api-error.interceptor';
import { HelpButton } from '@features/help/parts';
import {
  MemberSelection,
  StudentGroup,
  memberRecipients,
  IdentityApi,
} from '@features/identity/parts';
import { ScheduleApi, ScheduledLesson } from '@features/schedule/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { Confirm } from '@shared/ui/confirm';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { PageHeader } from '@shared/ui/page-header';
import { Avatar } from '@shared/ui/avatar';
import { InputChip } from '@shared/ui/input-chip';
import {
  SectionNav,
  SectionNavAction,
  SectionNavItem,
  SectionNavPress,
} from '@shared/ui/section-nav';
import { HomeworkApi } from '../data-access/homework-api';
import {
  AssignmentDetails,
  AssignmentInput,
  Attachment,
  BoundTextbook,
  QuizAnswer,
  QuizReveal,
} from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { Due, DueChips, dueAtOf } from '../ui/due-chips';
import { AttachmentList } from '../ui/attachment-list';
import { BoardPick, MaterialChips } from '../ui/material-chips';
import { RecipientsField } from '../ui/recipients-field';
import { TextbookList } from '../ui/textbook-list';
import { videoName } from '../ui/video-list';
import { titleOf } from './assignment-draft';
import { assignmentBoard } from './assignment-board';
import { AssignMoreDialog } from './assign-more-dialog';
import { BindTextbookDialog } from './bind-textbook-dialog';
import { MaterialOpener } from './material-opener';
import { NEXT_LESSON_DAYS, nextLessonStart } from './next-lesson';
import {
  MAX_QUESTIONS,
  QUESTION_ICONS,
  QuestionDraft,
  firstProblem,
  questionDraft,
  questionInputs,
  asStudentSees,
} from './question-drafts';
import { QuestionSection } from './question-section';
import { QuizSettings } from './quiz-settings';
import { QuizPlayer } from '../student/quiz-player';
import { MAX_VIDEOS, VideoDraft, VideoSection, videoDraft, videoInputs } from './video-section';

/** A student that can receive homework. */
export interface StudentOption {
  readonly id: string;
  readonly displayName: string;
}

/** «Задание», «Тест» and, on a phone, «Настройки» of the test. */
type EditorTab = 'task' | 'quiz' | 'settings';

/** Questions on the summary card of «Задание». */
const SUMMARY_QUESTIONS = 3;
const AUTOSAVE_DELAY = 1500;
const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

/** Files the AI reads (ADR-0039). */
const AI_READABLE = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;

/**
 * Teacher: the page that creates an assignment or edits one, on two tabs (sketches 11, 28): «Задание» in the
 * order who gets it, one Markdown text whose first line is the title, the due date as chips,
 * the materials (textbooks, files, videos, a board) and the test as a summary card — and «Тест» with the questions
 * and how the test goes (on a phone «Вопросы» and «Настройки»). A draft saves itself a moment after each change
 * and is given out with «Выдать»: created first, it gets its materials, and only then goes to the students — they
 * are notified with everything in place. An issued assignment has «Сохранить». The AI assistant opens beside.
 */
@Component({
  selector: 'tb-assignment-editor-page',
  imports: [
    ReactiveFormsModule,
    Pane,
    Panes,
    PaneHeader,
    Drawer,
    ModalDrawer,
    Button,
    Card,
    Menu,
    Message,
    DueChips,
    MaterialChips,
    AttachmentList,
    RecipientsField,
    SectionNav,
    Avatar,
    InputChip,
    AssignMoreDialog,
    SelectButton,
    Textarea,
    HomeworkAiPanel,
    ToBoardDialog,
    HelpButton,
    MarkdownView,
    PageHeader,
    LoadStateView,
    FieldErrors,
    TextbookList,
    BindTextbookDialog,
    VideoSection,
    QuestionSection,
    QuizPlayer,
    QuizSettings,
    Tabs,
    TabList,
    Tab,
  ],
  providers: [HomeworkAiState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <tb-panes>
        <tb-pane [label]="heading()">
          <ng-template tbPaneHeader>
            <tb-page-header
              class="tb-page-header--one-line"
              [title]="heading()"
              [back]="backLink()"
              [backLabel]="backLabel()"
            >
              <tb-help-button help topic="teacher/homework" />
              @if (activeTab() === 'quiz' && questions().length > 0) {
                <p-button
                  [label]="compact() ? undefined : t.studentView"
                  [ariaLabel]="t.studentView"
                  icon="tb-i tb-i-visibility"
                  severity="secondary"
                  [attr.aria-haspopup]="'dialog'"
                  (onClick)="openStudentView()"
                />
              }
              @if (aiEnabled()) {
                <p-button
                  [label]="compact() ? undefined : t.aiTitle"
                  [ariaLabel]="t.aiTitle"
                  icon="tb-i tb-i-auto_awesome"
                  severity="secondary"
                  [ariaExpanded]="single() ? modalAiOpen() : aiOpen()"
                  (onClick)="toggleAi()"
                />
              }
              @if (draft() && compact()) {
                <!-- a phone (sketch 21): «Выдать» alone; the board is not chosen there -->
                <p-button
                  [label]="c.assign"
                  [loading]="pending() && !autosaving()"
                  (onClick)="save()"
                />
              } @else if (draft()) {
                @if (savedAt(); as at) {
                  <span class="tb-editor__saved" role="status">{{ t.savedAt(at) }}</span>
                }
                <span class="tb-split" role="group" [attr.aria-label]="c.assign">
                  <p-button
                    styleClass="tb-split__main"
                    [label]="c.assign"
                    icon="tb-i tb-i-send"
                    [loading]="pending() && !autosaving()"
                    (onClick)="save()"
                  />
                  <p-button
                    styleClass="tb-split__more"
                    icon="tb-i tb-i-expand_more"
                    [ariaLabel]="c.assignMenu"
                    (onClick)="menu.toggle($event)"
                  />
                  <p-menu #menu [model]="assignMenu" [popup]="true" appendTo="body" />
                </span>
              } @else {
                <p-button
                  [label]="t.save"
                  icon="tb-i tb-i-check"
                  [loading]="pending()"
                  (onClick)="save()"
                />
              }
            </tb-page-header>
          </ng-template>
          <p-tabs
            class="tb-tabs tb-editor__tabs"
            [class.tb-tabs--fixed]="compact()"
            [value]="activeTab()"
            (valueChange)="choose($event)"
          >
            <p-tablist [attr.aria-label]="t.tabs">
              <p-tab value="task">
                <span class="tb-tab-label">
                  @if (!compact()) {
                    <i class="tb-i tb-i-description" aria-hidden="true"></i>
                  }
                  {{ t.tabTask }}
                </span>
              </p-tab>
              @if (compact()) {
                <p-tab value="quiz"
                  ><span class="tb-tab-label">{{ t.tabQuestions(questions().length) }}</span></p-tab
                >
                <p-tab value="settings"
                  ><span class="tb-tab-label">{{ t.tabSettings }}</span></p-tab
                >
              } @else {
                <p-tab value="quiz">
                  <span class="tb-tab-label">
                    <i class="tb-i tb-i-quiz" aria-hidden="true"></i>
                    {{ t.tabQuiz(questions().length) }}
                  </span>
                </p-tab>
              }
            </p-tablist>
          </p-tabs>
          @if (activeTab() === 'task') {
            <div class="tb-editor__layout">
              @if (showNav()) {
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
                [formGroup]="form"
                (ngSubmit)="save()"
              >
                <div class="tb-editor__columns">
                  <div class="tb-editor__main">
                    <p-card id="editor-task" styleClass="tb-section-card" class="tb-editor__task">
                      <div class="tb-field">
                        <div class="tb-field__header">
                          <label for="editor-text">{{ c.task }}</label>
                          <p-selectbutton
                            [options]="modes"
                            [formControl]="mode"
                            optionLabel="label"
                            optionValue="value"
                            [allowEmpty]="false"
                            [ariaLabel]="t.editorMode"
                          />
                        </div>
                        @if (modeValue() === 'preview') {
                          <div class="tb-preview" [style.min-height.px]="editorHeight()">
                            <tb-markdown [text]="textValue()" />
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
                      <p-card
                        id="editor-videos"
                        styleClass="tb-section-card"
                        class="tb-editor__videos"
                      >
                        <div class="tb-editor__card-head">
                          <h2 class="tb-subtitle">{{ t.videosTitle }}</h2>
                          <span class="tb-hint">{{
                            t.videoCount(videos().length, maxVideos)
                          }}</span>
                        </div>
                        <tb-video-section
                          [videos]="videos()"
                          (videosChange)="changeVideos($event)"
                        />
                      </p-card>
                    }

                    @if (pickedBoard(); as picked) {
                      <p-card
                        id="editor-board"
                        styleClass="tb-section-card"
                        class="tb-editor__board"
                      >
                        <h2 class="tb-subtitle tb-editor__card-head">{{ t.boardTitle }}</h2>
                        <div class="tb-editor__chips">
                          <tb-input-chip
                            [label]="picked.title"
                            [removeLabel]="c.remove"
                            (removed)="pickedBoard.set(null)"
                          >
                            <i lead class="tb-i tb-i-co_present" aria-hidden="true"></i>
                          </tb-input-chip>
                        </div>
                        <p class="tb-hint">{{ draft() ? t.boardOnAssign : t.boardOnSave }}</p>
                      </p-card>
                    }

                    @if (questions().length > 0) {
                      <p-card
                        id="editor-quiz-summary"
                        styleClass="tb-section-card"
                        class="tb-editor__quiz"
                      >
                        <div class="tb-editor__card-head">
                          <h2 class="tb-subtitle">{{ t.quizTitle }}</h2>
                          <span class="tb-hint">{{ quizSummary() }}</span>
                        </div>
                        <ul class="tb-list tb-list--no-lead" [attr.aria-label]="t.quizTitle">
                          @for (
                            question of firstQuestions();
                            track question.id;
                            let index = $index
                          ) {
                            <li>
                              <span class="tb-editor__quiz-row">
                                <b>{{ index + 1 }}</b>
                                <i
                                  class="tb-i {{ icons[question.type] }}"
                                  aria-hidden="true"
                                  [title]="tq.types[question.type]"
                                ></i>
                                <span class="tb-editor__quiz-text">{{
                                  question.text.trim() || t.untitledQuestion
                                }}</span>
                              </span>
                              <span class="tb-list__trail tb-hint">{{ question.points }}</span>
                            </li>
                          }
                          @if (questions().length > firstQuestions().length) {
                            <li>
                              <span class="tb-editor__quiz-row tb-hint">{{
                                t.quizMore(questions().length - firstQuestions().length)
                              }}</span>
                            </li>
                          }
                        </ul>
                        <p class="tb-hint">{{ t.quizWhere }}</p>
                        <p-button
                          [label]="t.openQuiz"
                          icon="tb-i tb-i-edit"
                          severity="secondary"
                          (onClick)="choose('quiz')"
                        />
                      </p-card>
                    }
                    @if (error(); as message) {
                      <p-message severity="error" styleClass="tb-form-message">{{
                        message
                      }}</p-message>
                    }
                  </div>

                  <div class="tb-editor__aside" role="group" [attr.aria-label]="t.params">
                    <p-card styleClass="tb-section-card" class="tb-editor__who-card">
                      <div class="tb-editor__who">
                        @if (draft()) {
                          <tb-recipients-field
                            inputId="editor-students"
                            [control]="form.controls.members"
                            [students]="studentOptions()"
                            [groups]="groups()"
                          />
                        } @else {
                          <div class="tb-field">
                            <span id="editor-given">{{ c.whom }}</span>
                            <div
                              class="tb-editor__chips"
                              role="group"
                              aria-labelledby="editor-given"
                            >
                              @for (task of assignment()?.tasks ?? []; track task.taskId) {
                                <tb-input-chip [label]="task.studentName" [readonly]="true">
                                  <tb-avatar lead [name]="task.studentName" size="1.5rem" />
                                </tb-input-chip>
                              }
                              <p-button
                                [label]="t.assignMore"
                                icon="tb-i tb-i-add"
                                severity="secondary"
                                (onClick)="giveMore()"
                              />
                            </div>
                          </div>
                        }

                        <tb-due-chips
                          [lesson]="nextLesson()"
                          [choice]="dueChoice()"
                          (choiceChange)="chooseDue($event)"
                          [date]="duePicked()"
                          (dateChange)="pickDue($event)"
                        />
                      </div>
                    </p-card>

                    @if (draft() || extrasInMaterials()) {
                      <p-card
                        id="editor-materials"
                        styleClass="tb-section-card"
                        class="tb-editor__materials-card"
                        [header]="c.materials"
                      >
                        <div class="tb-editor__materials tb-list--clamp">
                          @if (draft()) {
                            <div class="tb-list-group">
                              <tb-textbook-list
                                [textbooks]="textbooks()"
                                [editable]="true"
                                [withBoard]="false"
                                (opened)="materials.textbook($event)"
                                (edit)="editTextbook($event)"
                                (remove)="removeTextbook($event)"
                              />
                              <tb-attachment-list
                                [attachments]="savedFiles()"
                                [removable]="true"
                                (download)="materials.file($event)"
                                (remove)="removeFile($event)"
                              />
                            </div>
                          }
                          <tb-material-chips
                            [(files)]="newFiles"
                            [compact]="compact()"
                            [withFiles]="draft()"
                            [videosFull]="videosFull()"
                            [withExtras]="extrasInMaterials()"
                            [boardPicked]="pickedBoard() !== null"
                            (textbook)="bindTextbook()"
                            (video)="addVideo()"
                            (board)="chooseBoard($event)"
                          />
                        </div>
                      </p-card>
                    }
                  </div>
                </div>
              </form>
            </div>
          } @else {
            <div class="tb-editor tb-form">
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              @if (activeTab() === 'quiz') {
                <tb-question-section
                  id="editor-quiz"
                  [questions]="questions()"
                  (questionsChange)="changeQuestions($event)"
                  [reveal]="quizReveal()"
                  (revealChange)="changeReveal($event)"
                  [attempts]="quizAttempts()"
                  (attemptsChange)="changeAttempts($event)"
                  [locked]="quizLocked()"
                  [error]="quizError()"
                  [showProblems]="quizChecked()"
                  [compact]="compact()"
                  [single]="single()"
                  [status]="savedStatus()"
                  (ai)="openAi()"
                  (copyQuiz)="copyForEdits()"
                />
                <tb-quiz-player
                  [(visible)]="studentView"
                  [questions]="studentQuestions()"
                  [(answers)]="studentAnswers"
                  [title]="tt.testTitle(titleValue())"
                  [subtitle]="t.studentViewNote"
                  [exitLabel]="t.studentViewClose"
                  (finished)="studentView.set(false)"
                />
              }
              @if (activeTab() === 'settings') {
                <p-card id="quiz-settings" styleClass="tb-section-card" [header]="tq.settings">
                  <tb-quiz-settings
                    [reveal]="quizReveal()"
                    (revealChange)="changeReveal($event)"
                    [attempts]="quizAttempts()"
                    (attemptsChange)="changeAttempts($event)"
                  />
                </p-card>
              }
            </div>
          }
        </tb-pane>
        @if (aiEnabled() && !single() && aiOpen()) {
          <tb-pane class="tb-editor__ai" kind="fixed" [label]="t.aiTitle">
            <ng-template tbPaneHeader>
              <div class="tb-editor__ai-head">
                <h2 class="tb-subtitle">{{ t.aiTitle }}</h2>
                <p-button
                  [ariaLabel]="t.closeAi"
                  icon="tb-i tb-i-close"
                  [text]="true"
                  severity="secondary"
                  (onClick)="aiOpen.set(false)"
                />
              </div>
            </ng-template>
            <tb-homework-ai-panel
              [pane]="true"
              (sourceAdd)="bindTextbook()"
              [title]="titleValue()"
              [hasText]="textValue().trim() !== ''"
              [sources]="sourceOptions()"
              [questionCount]="questions().length"
              [quizLocked]="quizLocked()"
              (applied)="applyDraft($event)"
              (questionsApplied)="applyQuestions($event)"
            />
          </tb-pane>
        }
      </tb-panes>
      @if (aiEnabled() && single()) {
        <p-drawer
          tbModalDrawer
          [(visible)]="modalAiOpen"
          [header]="t.aiTitle"
          [ariaCloseLabel]="t.closeAi"
          [position]="compact() ? 'bottom' : 'right'"
          [blockScroll]="true"
          [styleClass]="compact() ? 'tb-sheet tb-editor-ai-drawer' : 'tb-editor-ai-drawer'"
          [style]="compact() ? {} : { width: 'min(100vw, 25rem)' }"
        >
          <tb-homework-ai-panel
            [pane]="true"
            (sourceAdd)="bindTextbook()"
            [title]="titleValue()"
            [hasText]="textValue().trim() !== ''"
            [sources]="sourceOptions()"
            [questionCount]="questions().length"
            [quizLocked]="quizLocked()"
            (applied)="applyDraft($event)"
            (questionsApplied)="applyQuestions($event)"
          />
        </p-drawer>
      }

      @if (placing(); as saved) {
        <tb-to-board-dialog
          [visible]="true"
          (visibleChange)="$event || leaveTo(saved)"
          [title]="saved.title"
          [markdown]="saved.description ?? ''"
          [students]="placingStudents()"
          [preferred]="pickedBoard()?.id ?? null"
          [frame]="board()?.frame ?? null"
          [pictures]="board()?.pictures ?? []"
          (placed)="rememberBoard(saved, $event)"
        />
      }
      @if (assignment(); as current) {
        <tb-assign-more-dialog
          [assignmentId]="current.id"
          [assigned]="givenTo()"
          (saved)="given($event)"
        />
      }
      <p-menu #boardMenu [model]="boardItems()" [popup]="true" appendTo="body" />
      <tb-bind-textbook-dialog
        [(visible)]="bindVisible"
        [taken]="textbooks()"
        [bound]="binding()"
        (picked)="pickTextbook($event)"
      />
    } @else {
      <tb-page-header [title]="t.editAssignment" back="/teacher/homework" [backLabel]="t.back" />
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
    }
  `,
  styles: `
    .tb-editor__ai {
      background: var(--p-md-surface-container-low);
    }

    .tb-editor__ai-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
    }

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

    .tb-editor__who-card {
      order: -1;
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

      .tb-editor__who {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .tb-editor__who {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
      gap: var(--tb-space-4) var(--tb-space-6);
    }

    .tb-editor__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-editor__text {
      width: 100%;
    }

    .tb-editor__materials {
      display: grid;
      gap: var(--tb-space-2);
    }

    .tb-editor__saved {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-editor__tabs {
      display: block;
      margin-block-end: var(--tb-space-4);
    }

    .tb-editor__card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--tb-space-2) var(--tb-space-4);
      margin-block-end: var(--tb-space-3);
    }

    /* one line: the number, the type icon and the text; the points are the row's trail */
    .tb-editor__quiz-row {
      grid-area: text;
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-width: 0;
    }

    .tb-editor__quiz-row .tb-i {
      color: var(--p-md-primary);
      font-size: 1.25rem;
    }

    .tb-editor__quiz-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class AssignmentEditorPage implements OnInit, OnChanges, CanLeave {
  protected readonly t = T.editor;
  protected readonly c = T.create;
  protected readonly maxVideos = MAX_VIDEOS;
  private readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');
  protected readonly single = computed(() => this.size() === 'compact' || this.size() === 'medium');
  protected readonly aiOpen = signal(false);
  protected readonly modalAiOpen = signal(false);

  protected toggleAi(): void {
    if (this.single()) this.modalAiOpen.update((open) => !open);
    else this.aiOpen.update((open) => !open);
  }

  /** «С ИИ» of the quiz: the assistant opens on drafting questions. */
  protected openAi(): void {
    if (this.single()) this.modalAiOpen.set(true);
    else this.aiOpen.set(true);
  }
  protected readonly tq = T.quiz;
  protected readonly tt = T.quizTake;
  /** «Как увидит ученик»: the full-screen test with the editor's questions; the answers stay here. */
  protected readonly studentView = signal(false);
  protected readonly studentAnswers = signal<Readonly<Record<string, QuizAnswer>>>({});
  protected readonly studentQuestions = computed(() =>
    asStudentSees(questionInputs(this.questions())),
  );

  protected openStudentView(): void {
    this.studentAnswers.set({});
    this.studentView.set(true);
  }
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  private readonly identity = inject(IdentityApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);
  private readonly confirm = inject(Confirm);
  protected readonly materials = inject(MaterialOpener);

  /** Route parameter of `/teacher/homework/:assignmentId/edit`; none — a new assignment. */
  readonly assignmentId = input<string>();

  protected readonly isNew = computed(() => this.assignmentId() === undefined);
  protected readonly assignment = signal<AssignmentDetails | null>(null);
  protected readonly ready = computed(() => this.isNew() || this.assignment() !== null);
  protected readonly state = new LoadState();
  protected readonly modes = [
    { label: T.editor.write, value: 'edit' },
    { label: T.editor.preview, value: 'preview' },
  ];

  readonly mode = new FormControl<'edit' | 'preview'>('edit', { nonNullable: true });
  readonly form = new FormGroup({
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20_000)],
    }),
    members: new FormControl<MemberSelection[]>([], { nonNullable: true }),
  });

  /** The height of the text field, kept while the preview is shown so switching never moves the page. */
  protected readonly editorHeight = signal<number | null>(null);
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  protected readonly modeValue = toSignal(
    this.mode.valueChanges.pipe(
      tap(() => {
        const field = this.editor();
        if (field) {
          this.editorHeight.set(field.nativeElement.offsetHeight);
        }
      }),
    ),
    {
      initialValue: this.mode.value,
    },
  );
  protected readonly textValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  /** The first line of the text, without Markdown marks. */
  protected readonly titleValue = computed(() => titleOf(this.textValue()));
  private readonly chosenMembers = toSignal(this.form.controls.members.valueChanges, {
    initialValue: [],
  });
  /** The assignment's title as it is typed (sketch 11); before the first line — «Новое задание». */
  protected readonly heading = computed(
    () => this.titleValue() || (this.isNew() ? T.editor.newAssignment : T.editor.editAssignment),
  );
  /** The page the editor was opened from (the list with its filters, the assignment, a student): «Назад» leads there. */
  private readonly origin = withoutCreate(
    (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())?.previousNavigation
      ?.finalUrl ?? null,
  );
  protected readonly backLink = computed(() => {
    if (this.origin !== null) {
      return this.origin;
    }
    const assignment = this.assignment();
    return assignment === null || this.isNew()
      ? '/teacher/homework'
      : ['/teacher/homework', assignment.id];
  });
  protected readonly backLabel = computed(() =>
    this.origin !== null ? SHARED_T.common.back : (this.assignment()?.title ?? T.editor.back),
  );

  /** A saved assignment nobody has yet: its students are still a choice. */
  protected readonly isDraft = computed(() => this.assignment()?.tasks.length === 0);
  /** A new assignment or a saved draft: it saves itself and is given out with «Выдать». */
  protected readonly draft = computed(() => this.isNew() || this.isDraft());

  /** The open tab: `?tab=`, then the teacher's choice; «Настройки» is a tab of its own on a phone only. */
  readonly tab = input<string>();
  private readonly chosenTab = signal<string | null>(null);
  protected readonly activeTab = computed<EditorTab>(() => {
    const tab = this.chosenTab() ?? this.tab();
    if (tab === 'settings') {
      return this.compact() ? 'settings' : 'quiz';
    }
    return tab === 'quiz' ? 'quiz' : 'task';
  });
  protected readonly icons = QUESTION_ICONS;
  /** The first questions on the summary card of «Задание». */
  protected readonly firstQuestions = computed(() => this.questions().slice(0, SUMMARY_QUESTIONS));
  protected readonly quizSummary = computed(() =>
    T.editor.quizSummary(
      this.questions().length,
      this.questions().reduce((sum, question) => sum + question.points, 0),
      this.quizAttempts(),
    ),
  );
  /** Files saved with a draft: removed here, an issued assignment has them on its page. */
  protected readonly savedFiles = computed(() =>
    this.isDraft() ? (this.assignment()?.attachments ?? []) : [],
  );
  /** «сохранено · HH:mm» of the last autosave. */
  protected readonly savedAt = signal<string | null>(null);
  /** «сохранено · HH:mm» under a question full screen on a phone. */
  protected readonly savedStatus = computed(() => {
    const at = this.savedAt();
    return at === null ? null : this.t.savedAt(at);
  });
  protected readonly autosaving = signal(false);
  /** Milliseconds of quiet before a draft saves itself. */
  autosaveDelay = AUTOSAVE_DELAY;
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the server has (see {@link snapshot}); a draft differing from it saves itself. */
  private savedSnapshot = '';
  /** A change came while a save was running: save once more after it. */
  private saveAgain = false;
  /** «Выдать» pressed during an autosave: runs after it. */
  private queued: (() => void) | null = null;
  private readonly aiState = inject(HomeworkAiState);
  private readonly location = inject(Location);
  /** The students of an issued assignment; «Выдать ещё» adds more. */
  protected readonly givenTo = computed(
    () => this.assignment()?.tasks.map((task) => task.studentId) ?? [],
  );
  private readonly assignMore = viewChild(AssignMoreDialog);
  /** The student list is in: only then a draft's students are saved (an empty list must not wipe them). */
  private readonly studentsLoaded = signal(false);
  protected readonly showNav = computed(() => !this.single() && !this.aiOpen());
  protected readonly navItems = computed<SectionNavItem[]>(() => {
    const videos = this.videos().length;
    const questions = this.questions().length;
    return [
      { id: 'editor-task', icon: 'tb-i-notes', label: this.t.sectionTask },
      ...(videos > 0 || this.videoField()
        ? [{ id: 'editor-videos', icon: 'tb-i-smart_display', label: this.t.sectionVideos(videos) }]
        : []),
      ...(this.pickedBoard() === null
        ? []
        : [{ id: 'editor-board', icon: 'tb-i-co_present', label: this.t.boardTitle }]),
      ...(questions > 0
        ? [{ id: 'editor-quiz-summary', icon: 'tb-i-quiz', label: this.t.sectionQuiz(questions) }]
        : []),
    ];
  });

  /** «Добавить» of the section menu (sketch 11): a video and, until one is chosen, a board. */
  protected readonly navActions = computed<SectionNavAction[]>(() => [
    {
      id: 'video',
      icon: 'tb-i-smart_display',
      label: this.t.addVideo,
      disabled: this.videosFull(),
    },
    ...(this.pickedBoard() === null
      ? [{ id: 'board', icon: 'tb-i-co_present', label: this.t.addBoard }]
      : []),
  ]);
  /** No section menu (a tablet, the assistant open): «Видео» and «Доска» are chips of the materials; a phone has neither. */
  protected readonly extrasInMaterials = computed(() => !this.showNav() && !this.compact());
  protected readonly videosFull = computed(() => this.videos().length >= MAX_VIDEOS);
  private readonly boards = inject(BoardsApi);
  private readonly boardMenu = viewChild<Menu>('boardMenu');
  protected readonly boardItems = signal<MenuItem[]>([]);

  protected readonly students = signal<StudentOption[]>([]);
  protected readonly groups = signal<StudentGroup[]>([]);
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ id: student.id, name: student.displayName })),
  );
  /** The students the assignment goes to: the chosen ones and the members of the chosen groups. */
  protected readonly recipients = computed(() =>
    memberRecipients(
      this.chosenMembers(),
      this.groups(),
      this.students().map((student) => student.id),
    ),
  );
  /** Lessons ahead, for the due date of a new assignment. */
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  protected readonly nextLesson = computed(() =>
    this.isNew() ? nextLessonStart(this.lessons(), this.recipients(), new Date()) : null,
  );
  protected readonly dueChoice = signal<Due>('lesson');
  protected readonly duePicked = signal<Date | null>(null);
  /** The teacher changed the due date: leaving asks. */
  private readonly dueChanged = signal(false);
  private readonly dueAt = computed(() =>
    dueAtOf(this.dueChoice(), this.nextLesson(), this.duePicked()),
  );

  readonly newFiles = signal<File[]>([]);
  /** The videos by link (ADR-0047): saved with the assignment, the whole list. */
  readonly videos = signal<readonly VideoDraft[]>([]);
  /** The teacher changed the videos: leaving asks. */
  private readonly videosChanged = signal(false);
  /** The chip «Видео» shows the link field even before the first video. */
  protected readonly videoField = signal(false);
  private readonly videoSection = viewChild(VideoSection);
  private readonly injector = inject(Injector);
  /** The questions of the quiz (ADR-0052) and how it goes; saved with the assignment. */
  readonly questions = signal<readonly QuestionDraft[]>([]);
  protected readonly quizReveal = signal<QuizReveal>('AFTER_SUBMIT');
  /** 0 — unlimited. */
  protected readonly quizAttempts = signal(1);
  /** The teacher changed the quiz: leaving asks and the quiz is sent. */
  private readonly quizChanged = signal(false);
  /** A student started the quiz: the questions can no longer change. */
  protected readonly quizLocked = signal(false);
  protected readonly quizError = signal<string | null>(null);
  /** A save was tried: each question says what is wrong with it. */
  protected readonly quizChecked = signal(false);
  /** The assignment goes on a board once saved: «Доска». */
  protected readonly pickedBoard = signal<BoardPick | null>(null);
  /** Textbooks of a new assignment, bound after it is created. */
  private readonly pickedTextbooks = signal<readonly BoundTextbook[]>([]);
  /** The saved textbooks and, in a draft, the picked ones not saved yet (a picked one wins: new pages). */
  protected readonly textbooks = computed(() => {
    const picked = this.pickedTextbooks();
    const saved = (this.assignment()?.textbooks ?? []).filter(
      (textbook) => !picked.some((candidate) => candidate.textbookId === textbook.textbookId),
    );
    return this.draft() ? [...saved, ...picked] : saved;
  });
  /**
   * What the AI may read for a draft: the bound textbooks (not Word files) and the PDF and picture files — saved ones by
   * reference (ADR-0039), picked ones of a new assignment with the request (ADR-0042).
   */
  readonly sourceOptions = computed<SourceOption[]>(() => {
    const assignment = this.assignment();
    const textbooks = this.textbooks()
      .filter((textbook) => textbook.format !== 'DOCUMENT')
      .map((textbook) => ({
        key: `textbook-${textbook.textbookId}`,
        label:
          textbook.pages === null
            ? textbook.title
            : `${textbook.title}, ${T.editor.pages(textbook.pages)}`,
        source: { type: 'TEXTBOOK' as const, id: textbook.textbookId, pages: textbook.pages },
      }));
    const files =
      assignment === null
        ? []
        : assignment.attachments
            .filter((file) => AI_READABLE.test(file.contentType))
            .map((file) => ({
              key: `file-${file.id}`,
              label: file.filename,
              source: { type: 'FILE' as const, id: file.id, assignmentId: assignment.id },
            }));
    const picked = this.newFiles()
      .filter((file) => AI_READABLE.test(file.type))
      .map((file) => ({
        key: `picked-${file.name}-${String(file.size)}-${String(file.lastModified)}`,
        label: file.name,
        source: file,
      }));
    const videos = this.videos()
      .filter((video) => video.url.trim() !== '' && video.transcript.trim() !== '')
      .map((video, index) => ({
        key: `video-${String(video.key)}`,
        label: T.videos.aiSource(videoName(video, index)),
        source: {
          type: 'VIDEO' as const,
          title: video.title.trim() === '' ? null : video.title.trim(),
          url: video.url.trim(),
          transcript: video.transcript,
        },
      }));
    return [...textbooks, ...files, ...picked, ...videos];
  });
  protected readonly bindVisible = signal(false);
  protected readonly binding = signal<BoundTextbook | null>(null);
  /** The saved assignment going on a board: «Выдать и разместить на доске». */
  protected readonly placing = signal<AssignmentDetails | null>(null);
  /** «На доску» offers the boards of its students. */
  protected readonly placingStudents = computed(
    () => this.placing()?.tasks.map((task) => task.studentId) ?? [],
  );
  /** Its text, pictures and textbook pages in a dated frame. */
  protected readonly board = computed(() => {
    const saved = this.placing();
    return saved === null ? null : assignmentBoard(saved, new Date());
  });
  protected readonly assignMenu: MenuItem[] = [
    {
      label: T.create.assignToBoard,
      icon: 'tb-i tb-i-co_present',
      command: () => {
        this.save(true);
      },
    },
  ];
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Set once the work is given out or saved: leaving asks nothing then. */
  private saved = false;
  /** The save gave a draft out: the editor goes back where it was opened from. */
  private issued = false;

  /** What a save sends besides the files and textbooks; a draft whose snapshot differs from the saved one saves itself. */
  private readonly snapshot = computed(() =>
    JSON.stringify([
      this.textValue(),
      this.chosenMembers(),
      this.dueAt()?.toISOString() ?? null,
      videoInputs(this.videos()),
      questionInputs(this.questions()),
      this.quizReveal(),
      this.quizAttempts(),
    ]),
  );

  constructor() {
    pageDetail(() => this.assignment()?.title);
    effect(() => {
      const snapshot = this.snapshot();
      const picked = this.newFiles().length + this.pickedTextbooks().length > 0;
      untracked(() => {
        if (this.ready() && this.draft() && (picked || snapshot !== this.savedSnapshot)) {
          this.scheduleAutosave();
        }
      });
    });
    // the assistant drafts text on «Задание» and questions on «Тест»
    effect(() => {
      const tab = this.activeTab();
      untracked(() => {
        this.aiState.mode.set(tab === 'task' ? 'TASK' : 'QUESTIONS');
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.autosaveTimer);
    });
  }

  /** «Создать копию для правок» opens the copy in this same page: it starts over with the copy. */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['assignmentId'];
    if (change !== undefined && !change.firstChange) {
      this.quizLocked.set(false);
      this.quizChecked.set(false);
      this.quizError.set(null);
      this.quizChanged.set(false);
      this.videosChanged.set(false);
      this.dueChanged.set(false);
      this.error.set(null);
      this.load();
    }
  }

  ngOnInit(): void {
    if (this.isNew()) {
      this.savedSnapshot = this.snapshot();
      this.loadStudents();
      this.loadGroups();
      const today = new Date();
      const until = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + NEXT_LESSON_DAYS,
      );
      this.schedule.lessons(toIsoDate(today), toIsoDate(until)).subscribe({
        next: (lessons) => {
          this.lessons.set(lessons);
        },
        error: () => {
          // without the schedule the due date stays for the teacher to set
        },
      });
    } else {
      this.load();
    }
  }

  protected load(): void {
    const id = this.assignmentId();
    if (id === undefined) {
      return;
    }
    this.api
      .assignment(id)
      .pipe(this.state.track())
      .subscribe((assignment) => {
        this.assignment.set(assignment);
        const text = assignment.description ?? '';
        this.form.reset({
          // the title is the first line of the text: a text that does not start with it gets it on top
          description:
            titleOf(text) === assignment.title ? text : `${assignment.title}\n\n${text}`.trimEnd(),
        });
        this.dueChoice.set(assignment.dueAt === null ? 'none' : 'date');
        this.duePicked.set(assignment.dueAt === null ? null : new Date(assignment.dueAt));
        this.videos.set(assignment.videos.map((video) => videoDraft(video)));
        this.loadQuiz(assignment);
        if (assignment.tasks.length === 0) {
          this.loadStudents();
          this.loadGroups();
          this.form.controls.members.setValue(
            assignment.draftStudentIds.map((id) => ({ kind: 'STUDENT' as const, id })),
          );
        }
        this.savedSnapshot = this.snapshot();
      });
  }

  private loadQuiz(assignment: AssignmentDetails): void {
    this.questions.set(
      assignment.questions.map((question) => questionDraft(question.type, question)),
    );
    this.quizReveal.set(assignment.quizReveal);
    this.quizAttempts.set(assignment.quizAttempts ?? 0);
    // a finished attempt shows the quiz was started; a started one only the server knows (homework.quiz-started)
    this.quizLocked.set(assignment.tasks.some((task) => task.quizScore !== null));
  }

  /** A locked quiz is changed in a copy of the assignment, opened on «Тест». */
  protected copyForEdits(): void {
    const id = this.assignmentId();
    if (id === undefined) {
      return;
    }
    this.api.copyAssignment(id).subscribe({
      next: (copy) => {
        this.snackbar.success(T.copy.copied(copy.title));
        void this.router.navigate(['/teacher/homework', copy.id, 'edit'], {
          queryParams: { tab: 'quiz' },
        });
      },
      error: (error: unknown) => {
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  private loadGroups(): void {
    this.identity.listGroups().subscribe((groups) => {
      this.groups.set(groups.filter((group) => group.archivedAt === null));
    });
  }

  private loadStudents(): void {
    this.identity.listStudents().subscribe((students) => {
      this.studentsLoaded.set(true);
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
  }

  protected giveMore(): void {
    this.assignMore()?.open(this.assignment()?.draftStudentIds ?? []);
  }

  /** «Выдать ещё» gave it to more students: the chips and the version follow, the text stays. */
  protected given(details: AssignmentDetails): void {
    this.assignment.set(details);
  }

  protected chooseDue(choice: Due): void {
    this.dueChoice.set(choice);
    this.dueChanged.set(true);
  }

  protected pickDue(date: Date | null): void {
    this.duePicked.set(date);
    this.dueChanged.set(true);
  }

  /**
   * Puts an AI draft into the editor; the teacher reviews it before saving. «Заменить» takes its title and text;
   * «Вставить» adds its text after the teacher's.
   */
  applyDraft({ draft, mode }: AppliedDraft): void {
    const text = this.form.controls.description.value;
    this.form.patchValue({
      description:
        mode === 'insert' && text.trim() !== ''
          ? `${text.trimEnd()}\n\n${draft.description}`
          : `${draft.title}\n\n${draft.description}`,
    });
    this.form.markAsDirty();
    this.mode.setValue('preview');
  }

  /** AI questions go into the quiz; the teacher reviews them in the questions card before saving. */
  applyQuestions({ questions, mode }: AppliedQuestions): void {
    const drafted = questions.map((question) => questionDraft(question.type, question));
    this.changeQuestions(
      (mode === 'replace' ? drafted : [...this.questions(), ...drafted]).slice(0, MAX_QUESTIONS),
    );
    this.form.markAsDirty();
  }

  changeVideos(videos: readonly VideoDraft[]): void {
    this.videos.set(videos);
    this.videosChanged.set(true);
  }

  protected add({ id, event }: SectionNavPress): void {
    if (id === 'video') this.addVideo();
    else this.chooseBoard(event);
  }

  /** The teacher's boards are read when the menu opens; an empty list says so instead of showing nothing. */
  protected chooseBoard(event: Event): void {
    this.boardMenu()?.toggle(event);
    this.boards.list({}, quietContext()).subscribe((boards) => {
      this.boardItems.set(
        boards.length === 0
          ? [{ label: this.c.noBoards, disabled: true }]
          : boards.map((board) => ({
              label: board.title,
              command: () => {
                this.pickedBoard.set({ id: board.id, title: board.title });
              },
            })),
      );
    });
  }

  protected addVideo(): void {
    this.videoField.set(true);
    afterNextRender(
      () => {
        this.videoSection()?.focusLink();
      },
      { injector: this.injector },
    );
  }

  changeQuestions(questions: readonly QuestionDraft[]): void {
    this.questions.set(questions);
    this.quizChanged.set(true);
  }

  changeReveal(reveal: QuizReveal): void {
    this.quizReveal.set(reveal);
    this.quizChanged.set(true);
  }

  changeAttempts(attempts: number): void {
    this.quizAttempts.set(attempts);
    this.quizChanged.set(true);
  }

  protected bindTextbook(): void {
    this.binding.set(null);
    this.bindVisible.set(true);
  }

  protected editTextbook(textbook: BoundTextbook): void {
    this.binding.set(textbook);
    this.bindVisible.set(true);
  }

  /** A textbook for a new assignment, or new pages of one already picked. */
  pickTextbook(textbook: BoundTextbook): void {
    this.pickedTextbooks.update((picked) => [
      ...picked.filter((candidate) => candidate.textbookId !== textbook.textbookId),
      textbook,
    ]);
  }

  /** A picked textbook goes from the list; a saved one of a draft is unbound at once. */
  protected removeTextbook(textbook: BoundTextbook): void {
    const picked = this.pickedTextbooks();
    if (picked.some((candidate) => candidate.textbookId === textbook.textbookId)) {
      this.pickedTextbooks.set(
        picked.filter((candidate) => candidate.textbookId !== textbook.textbookId),
      );
      return;
    }
    const saved = this.assignment();
    if (saved !== null) {
      this.api.unbindTextbook(saved.id, textbook.textbookId).subscribe({
        next: (details) => {
          this.assignment.set(details);
        },
        error: (error: unknown) => {
          this.error.set(describeError(error, T.editor.failed));
        },
      });
    }
  }

  /** A file saved with a draft is removed at once. */
  protected removeFile(file: Attachment): void {
    const saved = this.assignment();
    if (saved === null) {
      return;
    }
    this.api.removeMaterial(saved.id, file.id).subscribe({
      next: () => {
        this.assignment.update(
          (current) =>
            current && {
              ...current,
              attachments: current.attachments.filter((candidate) => candidate.id !== file.id),
            },
        );
      },
      error: (error: unknown) => {
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  /** «Задание», «Тест» (or on a phone «Вопросы», «Настройки»): kept in the address as `?tab=`. */
  choose(value: string | number | undefined): void {
    const tab: EditorTab = value === 'quiz' || value === 'settings' ? value : 'task';
    this.chosenTab.set(tab);
    const [path = '', query = ''] = this.location.path().split('?');
    const params = new URLSearchParams(query);
    if (tab === 'task') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    this.location.replaceState(path === '' ? '/' : path, params.toString());
  }

  /** «Выдать» of a draft, «Сохранить» of an issued assignment; `toBoard` then puts it on a board of its students. */
  save(toBoard = false): void {
    if (!revealErrors(this.form)) {
      return;
    }
    if (this.pending()) {
      if (this.autosaving()) {
        this.queued = () => {
          this.save(toBoard);
        };
      }
      return;
    }
    clearTimeout(this.autosaveTimer);
    if (this.titleValue() === '') {
      this.error.set(this.c.needText);
      return;
    }
    const draft = this.draft();
    if (draft && this.recipients().length === 0) {
      this.error.set(this.c.needWhom);
      return;
    }
    this.quizChecked.set(true);
    if (!this.quizLocked() && firstProblem(this.questions()) !== null) {
      // the «Тест» tab lists the questions to fix
      this.quizError.set(null);
      this.choose('quiz');
      return;
    }
    this.quizError.set(null);
    this.pending.set(true);
    this.error.set(null);
    const board = toBoard || this.pickedBoard() !== null;
    this.write(true).subscribe({
      next: ({ assignment, complete }) => {
        this.pending.set(false);
        this.saved = true;
        this.issued = draft;
        if (!complete) {
          this.snackbar.error(T.editor.materialsFailed);
        } else if (draft) {
          this.snackbar.link(T.editor.assigned, this.c.open, () => {
            void this.router.navigate(['/teacher/homework', assignment.id]);
          });
        } else {
          this.snackbar.success(T.editor.saved);
        }
        if (board) {
          this.assignment.set(assignment);
          this.placing.set(assignment);
        } else {
          this.leaveTo(assignment);
        }
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.refresh();
        const code = problemCode(error);
        if (code === 'homework.quiz-incomplete') {
          const broken = brokenQuestions(error);
          this.quizError.set(T.editor.incomplete(broken.length, broken.join(', ')));
          this.choose('quiz');
          return;
        }
        if (code?.startsWith('homework.quiz-') === true) {
          this.quizError.set(describeError(error, T.quiz.failed));
          if (code === 'homework.quiz-started') {
            this.lockQuiz();
          }
          return;
        }
        this.error.set(describeError(error, T.editor.failed));
      },
    });
  }

  private scheduleAutosave(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosave();
    }, this.autosaveDelay);
  }

  /** Saves the draft as it is now: no questions are checked, nothing goes to students; nothing without a title. */
  private autosave(): void {
    clearTimeout(this.autosaveTimer);
    if (this.saved || this.titleValue() === '' || this.form.invalid) {
      return;
    }
    if (this.pending()) {
      this.saveAgain = true;
      return;
    }
    const snapshot = this.snapshot();
    this.pending.set(true);
    this.autosaving.set(true);
    this.write(false).subscribe({
      next: ({ assignment, complete }) => {
        this.assignment.set(assignment);
        this.savedSnapshot = snapshot;
        this.savedAt.set(TIME.format(new Date()));
        this.error.set(complete ? null : T.editor.materialsFailed);
        this.afterAutosave();
      },
      error: (error: unknown) => {
        this.refresh();
        this.error.set(describeError(error, T.editor.autosaveFailed));
        this.afterAutosave();
      },
    });
  }

  private afterAutosave(): void {
    this.pending.set(false);
    this.autosaving.set(false);
    const queued = this.queued;
    this.queued = null;
    if (queued !== null) {
      queued();
    } else if (this.saveAgain) {
      this.saveAgain = false;
      this.autosave();
    }
  }

  /**
   * Creates or updates the assignment, adds the picked files and textbooks, then for a draft gives it out
   * (`give`) or keeps its students. A new assignment is remembered as soon as it exists, so a later step
   * that fails never makes a second one.
   */
  private write(give: boolean): Observable<{ assignment: AssignmentDetails; complete: boolean }> {
    const existing = this.assignment();
    const draft = this.draft();
    const students = this.recipients();
    const files = this.newFiles();
    const textbooks = this.pickedTextbooks();
    const text = this.form.controls.description.value;
    const dueAt = this.dueAt();
    const input: AssignmentInput = {
      title: this.titleValue(),
      description: text.trim() === '' ? null : text,
      dueAt: dueAt === null ? null : dueAt.toISOString(),
      videos: videoInputs(this.videos()),
      ...(this.quizChanged()
        ? {
            ...(this.quizLocked() ? {} : { questions: questionInputs(this.questions()) }),
            quizReveal: this.quizReveal(),
            quizAttempts: this.quizAttempts(),
          }
        : {}),
    };
    const saved =
      existing === null
        ? this.api.createAssignment(input)
        : this.api.updateAssignment(existing.id, input, existing.version);
    return saved.pipe(
      tap((first) => {
        this.remember(first, existing === null);
      }),
      switchMap((first) =>
        this.addMaterials(first.id, files, textbooks).pipe(
          tap(() => {
            // sent, even if some failed: they are not sent again
            this.newFiles.update((list) => list.filter((file) => !files.includes(file)));
            this.pickedTextbooks.update((list) => list.filter((book) => !textbooks.includes(book)));
          }),
          switchMap((complete) => {
            const next = !draft
              ? of(first)
              : give
                ? this.api.assignStudents(first.id, students)
                : (existing === null ? students.length > 0 : this.studentsLoaded())
                  ? this.api.saveDraftStudents(first.id, students)
                  : files.length + textbooks.length > 0
                    ? this.api.assignment(first.id)
                    : of(first);
            return next.pipe(map((assignment) => ({ assignment, complete })));
          }),
        ),
      ),
    );
  }

  /** The saved assignment and, for one just created, its address (the page stays as it is). */
  private remember(saved: AssignmentDetails, created: boolean): void {
    this.assignment.set(saved);
    if (created) {
      const [, query = ''] = this.location.path().split('?');
      this.location.replaceState(`/teacher/homework/${saved.id}/edit`, query);
    }
  }

  /** After a failed step the version may have moved on: take the assignment as the server has it. */
  private refresh(): void {
    const saved = this.assignment();
    if (saved !== null) {
      this.api.assignment(saved.id).subscribe({
        next: (details) => {
          this.assignment.set(details);
        },
        error: () => {
          // the next save reports what is wrong
        },
      });
    }
  }

  /** The server has the questions as they were: show those, read-only. */
  private lockQuiz(): void {
    this.quizLocked.set(true);
    const saved = this.assignment();
    if (saved !== null) {
      this.questions.set(saved.questions.map((question) => questionDraft(question.type, question)));
    }
  }

  /**
   * These files and textbooks, one after another; `false` when some did not make it (the assignment is saved
   * anyway).
   */
  private addMaterials(
    id: string,
    files: readonly File[],
    textbooks: readonly BoundTextbook[],
  ): Observable<boolean> {
    if (files.length === 0 && textbooks.length === 0) {
      return of(true);
    }
    const steps: Observable<boolean>[] = [
      ...(files.length === 0 ? [] : [this.api.uploadMaterials(id, files).pipe(map(() => true))]),
      ...textbooks.map((textbook) =>
        defer(() => this.api.bindTextbook(id, textbook.textbookId, textbook.pages)).pipe(
          map(() => true),
        ),
      ),
    ].map((step) => step.pipe(catchError(() => of(false))));
    return concat(...steps).pipe(
      toArray(),
      map((results) => results.every(Boolean)),
      last(),
    );
  }

  /** The board the saved assignment went on: its students get «Перейти на доску». */
  rememberBoard(assignment: AssignmentDetails, placed: Placed): void {
    this.api.placeOnBoard(assignment.id, placed.board.id).subscribe({
      error: () => {
        this.snackbar.error(T.editor.boardFailed);
      },
    });
  }

  /**
   * After the board dialog, if any, is closed: a given-out draft returns to where the editor was opened (the
   * list, the assignment), a saved assignment to its page.
   */
  leaveTo(assignment: AssignmentDetails): void {
    this.placing.set(null);
    const back = this.issued ? this.backLink() : ['/teacher/homework', assignment.id];
    void (Array.isArray(back) ? this.router.navigate(back) : this.router.navigateByUrl(back));
  }

  /** A draft saves what is left and lets go; an issued assignment asks before leaving changes. */
  canLeave(): boolean | Promise<boolean> {
    if (this.saved) {
      return true;
    }
    if (this.draft()) {
      if (this.unsaved()) {
        this.autosave();
      }
      return true;
    }
    const dirty =
      this.form.dirty || this.videosChanged() || this.quizChanged() || this.dueChanged();
    if (!dirty) {
      return true;
    }
    return this.confirm.danger({
      header: T.editor.leaveHeader,
      message: T.editor.leaveMessage,
      acceptLabel: T.editor.leave,
    });
  }

  private unsaved(): boolean {
    return (
      this.newFiles().length + this.pickedTextbooks().length > 0 ||
      this.snapshot() !== this.savedSnapshot
    );
  }
}

/** The numbers of the questions in a `homework.quiz-incomplete` answer. */
function brokenQuestions(error: unknown): number[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [];
  }
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null || !('questions' in body)) {
    return [];
  }
  const list: unknown = body.questions;
  return Array.isArray(list)
    ? (list as unknown[]).flatMap((item) =>
        typeof item === 'object' &&
        item !== null &&
        'number' in item &&
        typeof item.number === 'number'
          ? [item.number]
          : [],
      )
    : [];
}

/** `?create=` («Создать» in the rail) brought the page that opened the editor: going back must not open it again. */
function withoutCreate(url: UrlTree | null): UrlTree | null {
  if (url === null || !(CREATE_PARAM in url.queryParams)) {
    return url;
  }
  const params = Object.fromEntries(
    Object.entries(url.queryParams).filter(([key]) => key !== CREATE_PARAM),
  );
  return new UrlTree(url.root, params, url.fragment);
}
