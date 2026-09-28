import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Attachment, Submission } from '../data-access/homework.models';
import { AttachmentList } from './attachment-list';
import { EmptyState } from '@shared/ui/empty-state';

/** All attempts of a student, newest first. The answer text is shown as plain text. */
@Component({
  selector: 'tb-submission-list',
  imports: [EmptyState, DatePipe, AttachmentList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (submission of submissions(); track submission.id; let first = $first) {
      <article class="tb-submission" [class.tb-submission--old]="!first">
        <header class="tb-muted">
          {{ first ? 'Последний ответ' : 'Предыдущий ответ' }} ·
          {{ submission.submittedAt | date: 'dd.MM.yyyy HH:mm' }}
        </header>
        @if (submission.text) {
          <p class="tb-pre">{{ submission.text }}</p>
        }
        <tb-attachment-list
          [attachments]="submission.attachments"
          (download)="download.emit($event)"
        />
      </article>
    } @empty {
      <tb-empty-state icon="pi-comments" title="Ответов пока нет" />
    }
  `,
})
export class SubmissionList {
  readonly submissions = input.required<readonly Submission[]>();
  readonly download = output<Attachment>();
}
