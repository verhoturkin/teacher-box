import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';

/** `severity` of `p-tag` → its container role; no severity is the primary one. */
const TAGS = [
  { severity: undefined, role: 'primary-container' },
  { severity: 'secondary', role: 'secondary-container' },
  { severity: 'success', role: 'success-container' },
  { severity: 'warn', role: 'warning-container' },
  { severity: 'danger', role: 'error-container' },
  { severity: 'info', role: 'tertiary-container' },
] as const;

const MESSAGES = ['success', 'info', 'warn', 'error'] as const;

/** §2 Status = severity = role: the tags of statuses and the messages, by severity. */
@Component({
  selector: 'tb-gallery-status-roles',
  imports: [Tag, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      @for (tag of tags; track tag.role) {
        <li class="tb-gallery-cell">
          <p-tag [severity]="tag.severity" value="Status" />
          <code class="tb-gallery-name">severity="{{ tag.severity ?? '' }}"</code>
          <code class="tb-gallery-name">--p-md-{{ tag.role }}</code>
        </li>
      }
    </ul>
    <ul class="tb-gallery-grid messages">
      @for (severity of messages; track severity) {
        <li class="tb-gallery-cell">
          <p-message [severity]="severity" text="A message" />
          <code class="tb-gallery-name">p-message severity="{{ severity }}"</code>
        </li>
      }
    </ul>
  `,
  styles: `
    .messages {
      margin-top: var(--tb-space-4);
    }
  `,
})
export class StatusRolesSample {
  protected readonly tags = TAGS;
  protected readonly messages = MESSAGES;
}
