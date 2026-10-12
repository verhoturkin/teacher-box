import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Attachment, Submission } from '../data-access/homework.models';
import { AttachmentList } from './attachment-list';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from '../i18n/texts';

/**
 * All attempts of a student, newest first. The answer text is shown as plain text; «Готово» of homework on a board
 * or interactive homework — with what the page reported.
 */
@Component({
  selector: 'tb-submission-list',
  imports: [EmptyState, DatePipe, AttachmentList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (submission of submissions(); track submission.id; let first = $first) {
      <article class="tb-submission" [class.tb-submission--old]="!first">
        <header class="tb-muted">
          {{ first ? t.lastAnswer : t.previousAnswer }} ·
          {{ submission.submittedAt | date: 'dd.MM.yyyy HH:mm' }}
        </header>
        @if (submission.text) {
          <p class="tb-pre">{{ submission.text }}</p>
        } @else if (submission.attachments.length === 0) {
          <p>{{ t.markedDone }}</p>
        }
        @if (submission.result; as result) {
          @if (result.score !== null && result.maxScore !== null) {
            <p class="tb-strong">{{ t.pageResult(result.score, result.maxScore) }}</p>
          }
          @if (result.answers.length > 0) {
            <ol class="tb-page-answers" [attr.aria-label]="t.pageAnswers">
              @for (answer of result.answers; track $index) {
                <li>
                  <span>{{ answer.question }}</span> —
                  <span class="tb-pre">{{ answer.answer ?? t.noAnswer }}</span>
                  @if (answer.correct !== null) {
                    <span [class]="answer.correct ? 'tb-positive' : 'tb-negative'">
                      <i
                        [class]="answer.correct ? 'pi pi-check' : 'pi pi-times'"
                        aria-hidden="true"
                      ></i>
                      {{ answer.correct ? t.correct : t.wrong }}
                    </span>
                  }
                </li>
              }
            </ol>
          }
        }
        <tb-attachment-list
          [attachments]="submission.attachments"
          (download)="download.emit($event)"
        />
      </article>
    } @empty {
      <tb-empty-state icon="pi-comments" [title]="t.noAnswers" />
    }
  `,
})
export class SubmissionList {
  protected readonly t = T.ui;
  readonly submissions = input.required<readonly Submission[]>();
  readonly download = output<Attachment>();
}
