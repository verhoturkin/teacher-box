import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Button } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';
import { LinkCode } from '../data-access/notifications.models';
import { CHANNEL_HAS_START_LINK, CHANNEL_NAMES } from '../notification-labels';
import { T } from '../i18n/texts';

/**
 * How to connect an account to a bot with a one-time code: the link that opens the bot, the code with
 * «Копировать» and the wait for the connection (sketch `PhoneConnect`).
 */
@Component({
  selector: 'tb-link-code-view',
  imports: [DatePipe, Button, ProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let link = code();
    <div class="tb-link-code">
      @if (link.url !== null && startLink()) {
        <p>{{ t.start }}</p>
        <a class="p-button tb-link-code__open" [href]="link.url" target="_blank" rel="noopener">
          <i class="tb-i tb-i-open_in_new" aria-hidden="true"></i>
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
      <div class="tb-link-code__value">
        <span class="tb-link-code__digits">{{ link.code }}</span>
        <p-button
          icon="tb-i tb-i-content_copy"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          [ariaLabel]="t.copyCode"
          (onClick)="copy()"
        />
      </div>
      <div class="tb-link-code__wait" role="status">
        <p-progress-spinner strokeWidth="5" styleClass="tb-link-code__spinner" aria-hidden="true" />
        <small class="tb-muted">{{ t.validUntil((link.expiresAt | date: 'HH:mm') ?? '') }}</small>
      </div>
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
      display: flex;
      align-items: center;
      align-self: stretch;
      gap: var(--tb-space-2);
      padding: var(--tb-space-1) var(--tb-space-1) var(--tb-space-1) var(--tb-space-4);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface-container-highest);
      color: var(--p-md-on-surface);
      font-family: var(--tb-font-mono);
      font-size: 1.75rem;
      letter-spacing: 0.15em;
    }

    .tb-link-code__digits {
      flex: 1;
      user-select: all;
    }

    .tb-link-code__wait {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    :host ::ng-deep .tb-link-code__spinner {
      width: 1.5rem;
      height: 1.5rem;
    }
  `,
})
export class LinkCodeView {
  protected readonly t = T.linkCode;
  private readonly snackbar = inject(Snackbar);
  readonly code = input.required<LinkCode>();

  protected readonly name = computed(() => CHANNEL_NAMES[this.code().channel]);
  protected readonly startLink = computed(() => CHANNEL_HAS_START_LINK[this.code().channel]);

  /** Without clipboard access (an insecure page) the code stays selectable by a tap. */
  protected copy(): void {
    void navigator.clipboard.writeText(this.code().code).then(() => {
      this.snackbar.success(SHARED_T.common.copied);
    });
  }
}
