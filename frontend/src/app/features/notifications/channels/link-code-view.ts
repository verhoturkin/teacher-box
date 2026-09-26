import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LinkCode } from '../data-access/notifications.models';
import { CHANNEL_HAS_START_LINK, CHANNEL_NAMES } from '../notification-labels';

/** How to connect an account to a bot with a one-time code. */
@Component({
  selector: 'tb-link-code-view',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let link = code();
    <div class="tb-link-code">
      @if (link.url !== null && startLink()) {
        <p>Откройте бота и нажмите «Запустить» — аккаунт подключится автоматически.</p>
        <a class="p-button tb-link-code__open" [href]="link.url" target="_blank" rel="noopener">
          <i class="pi pi-external-link" aria-hidden="true"></i>
          <span>Открыть {{ name() }}</span>
        </a>
        <p class="tb-muted">Или отправьте боту код:</p>
      } @else {
        <p>
          Отправьте этот код
          @if (link.url !== null) {
            <a [href]="link.url" target="_blank" rel="noopener">боту {{ name() }}</a>
          } @else {
            боту {{ name() }}
          }
          в личные сообщения:
        </p>
      }
      <div class="tb-link-code__value">{{ link.code }}</div>
      <small class="tb-muted">Код действует до {{ link.expiresAt | date: 'HH:mm' }}. Ждём подключения…</small>
    </div>
  `,
  styles: `
    .tb-link-code {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;

      p {
        margin: 0;
      }
    }

    .tb-link-code__open {
      display: inline-flex;
      gap: 0.5rem;
      text-decoration: none;
    }

    .tb-link-code__value {
      padding: 0.5rem 1rem;
      border-radius: var(--p-border-radius-md);
      background: var(--p-surface-100);
      font-family: monospace;
      font-size: 1.75rem;
      letter-spacing: 0.15em;
      user-select: all;
    }
  `,
})
export class LinkCodeView {
  readonly code = input.required<LinkCode>();

  protected readonly name = computed(() => CHANNEL_NAMES[this.code().channel]);
  protected readonly startLink = computed(() => CHANNEL_HAS_START_LINK[this.code().channel]);
}
