import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LinkCode } from '../data-access/notifications.models';
import { CHANNEL_HAS_START_LINK, CHANNEL_NAMES } from '../notification-labels';
import { T } from '../i18n/texts';

/** How to connect an account to a bot with a one-time code. */
@Component({
  selector: 'tb-link-code-view',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let link = code();
    <div class="tb-link-code">
      @if (link.url !== null && startLink()) {
        <p>{{ t.start }}</p>
        <a class="p-button tb-link-code__open" [href]="link.url" target="_blank" rel="noopener">
          <i class="pi pi-external-link" aria-hidden="true"></i>
          <span>{{ t.open(name()) }}</span>
        </a>
        <p class="tb-muted">{{ t.orCode }}</p>
      } @else {
        <p>
          {{ t.sendCode }}
          @if (link.url !== null) {
            <a [href]="link.url" target="_blank" rel="noopener">{{ t.toBot(name()) }}</a>
          } @else {
            {{ t.toBot(name()) }}
          }
          {{ t.privately }}
        </p>
      }
      <div class="tb-link-code__value">{{ link.code }}</div>
      <small class="tb-muted">{{ t.validUntil((link.expiresAt | date: 'HH:mm') ?? '') }}</small>
    </div>
  `,
  styles: `
    .tb-link-code {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-3);

      p {
        margin: 0;
      }
    }

    .tb-link-code__open {
      display: inline-flex;
      gap: var(--tb-space-2);
      text-decoration: none;
    }

    .tb-link-code__value {
      padding: var(--tb-space-2) var(--tb-space-4);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-surface-container-highest);
      color: var(--p-md-on-surface);
      font-family: var(--tb-font-mono);
      font-size: 1.75rem;
      letter-spacing: 0.15em;
      user-select: all;
    }
  `,
})
export class LinkCodeView {
  protected readonly t = T.linkCode;
  readonly code = input.required<LinkCode>();

  protected readonly name = computed(() => CHANNEL_NAMES[this.code().channel]);
  protected readonly startLink = computed(() => CHANNEL_HAS_START_LINK[this.code().channel]);
}
