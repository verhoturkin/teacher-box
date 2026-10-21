import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { describeError } from '@core/http/error-messages';
import { pageDetail } from '@core/routing/page-detail';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { AiRequest, AiStatus, AiUsage, IntegrationStatus } from '../data-access/admin.models';
import { INTEGRATION_TAGS } from '../admin-labels';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PaneNav, PaneNavItem } from '@shared/ui/pane-nav';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { T } from '../i18n/texts';

type Section = 'connections' | 'ai';

/**
 * Administrator: connection to the messengers, the AI provider and Google; the log of AI requests. List-detail
 * (247.2): the sections in the fixed pane, the chosen one (`/admin/integrations/:section`) beside it; on
 * compact `/admin/integrations` is the list and a section has «back» to it.
 */
@Component({
  selector: 'tb-integrations-page',
  imports: [
    DatePipe,
    DecimalPipe,
    Button,
    Message,
    TableModule,
    Tag,
    RowType,
    PageHeader,
    HelpButton,
    EmptyState,
    LoadStateView,
    Panes,
    Pane,
    PaneNav,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes medium="two">
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.sections">
          <tb-page-header [title]="t.title">
            <tb-help-button help topic="admin/diagnostics" />
          </tb-page-header>
          <tb-pane-nav
            [items]="items()"
            base="/admin/integrations"
            [current]="layout.detail() ? current() : null"
            [label]="t.sections"
          />
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane [label]="currentTitle()">
          @if (layout.single()) {
            <tb-page-header
              [title]="currentTitle()"
              back="/admin/integrations"
              [backLabel]="t.all"
            />
          } @else {
            <h2 class="tb-integrations__heading">{{ currentTitle() }}</h2>
          }
          @if (current() === 'connections') {
            <div class="tb-stack">
              <p class="tb-muted">{{ t.about }}</p>
              <div>
                <p-button
                  [label]="t.run"
                  severity="secondary"
                  icon="tb-i tb-i-refresh"
                  [loading]="checking()"
                  (onClick)="check()"
                />
              </div>
              @if (error(); as message) {
                <p-message severity="error">{{ message }}</p-message>
              }
              @if (checks(); as checks) {
                <ul class="tb-checks">
                  @for (check of checks; track check.name) {
                    <li>
                      <strong>{{ check.name }}</strong>
                      <p-tag
                        [value]="tags[check.state].label"
                        [severity]="tags[check.state].severity"
                      />
                      <span class="tb-checks__detail">{{ check.detail }}</span>
                      @if (check.state !== 'NOT_CONFIGURED') {
                        <small class="tb-muted">{{ t.ms(check.millis) }}</small>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          } @else {
            <tb-load-state [state]="aiState" [what]="t.whatAi" (retry)="loadAi()">
              @if (ai(); as ai) {
                @if (ai.enabled) {
                  <p>
                    {{ ai.provider }} · {{ ai.model }} · {{ t.thisMonth }}
                    {{ t.tokens(ai.usedThisMonth) }}
                    @if (ai.monthlyTokenLimit > 0) {
                      {{ t.ofLimit((ai.monthlyTokenLimit | number) ?? '') }}
                    }
                  </p>
                } @else {
                  <p class="tb-muted">{{ t.aiOff }}</p>
                }
              }
              @if (usage(); as usage) {
                @if (recent().length === 0) {
                  <tb-empty-state icon="tb-i-auto_awesome" [title]="t.noRequests" />
                } @else {
                  <p-table [value]="recent()" styleClass="tb-cards">
                    <ng-template #header>
                      <tr>
                        <th>{{ t.when }}</th>
                        <th>{{ t.what }}</th>
                        <th>{{ t.result }}</th>
                        <th class="tb-num">{{ t.tokensColumn }}</th>
                        <th>{{ t.time }}</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-request [tbRowType]="recent()">
                      <tr>
                        <td [attr.data-label]="t.when">
                          {{ request.createdAt | date: 'dd.MM HH:mm' }}
                        </td>
                        <td [attr.data-label]="t.what">{{ request.feature }}</td>
                        <td [attr.data-label]="t.result">
                          <p-tag
                            [value]="requestStatus(request.status).label"
                            [severity]="requestStatus(request.status).severity"
                          />
                          @if (request.error !== null) {
                            <small class="tb-negative">{{ request.error }}</small>
                          }
                        </td>
                        <td [attr.data-label]="t.tokensColumn" class="tb-num">
                          {{ request.inputTokens | number }} / {{ request.outputTokens | number }}
                        </td>
                        <td [attr.data-label]="t.time">
                          {{ t.seconds((request.durationMs / 1000 | number: '1.1-1') ?? '') }}
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                  @if (moreRecent()) {
                    <p-button
                      [label]="t.showMore"
                      [text]="true"
                      [loading]="loadingMore()"
                      (onClick)="showMore(usage.month)"
                    />
                  }
                }
              }
            </tb-load-state>
          }
        </tb-pane>
      }
    </tb-panes>
  `,
  styles: `
    .tb-integrations__heading {
      margin: 0 0 var(--tb-space-4);
      font: var(--tb-type-headline-s-emphasized);
    }

    /* a check: the service and its state on the first line, the details and the time under them */
    .tb-checks {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: grid;
        grid-template-areas: 'name state' 'detail time';
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--tb-space-1) var(--tb-space-3);
      }

      strong {
        grid-area: name;
      }

      p-tag {
        grid-area: state;
        justify-self: end;
      }

      small {
        grid-area: time;
        align-self: start;
        white-space: nowrap;
      }
    }

    .tb-checks__detail {
      grid-area: detail;
      overflow-wrap: anywhere;
    }
  `,
})
export class IntegrationsPage implements OnInit {
  protected readonly t = T.integrations;

  /** Route parameter: the chosen section; none — the list (beside it the first section). */
  readonly section = input<string>();
  protected readonly layout = injectListDetail(() => this.section() !== undefined, 'two');
  protected readonly current = computed<Section>(() =>
    this.section() === 'ai' ? 'ai' : 'connections',
  );
  protected readonly currentTitle = computed(() =>
    this.current() === 'ai' ? this.t.ai : this.t.check,
  );
  protected readonly items = computed<PaneNavItem[]>(() => [
    {
      id: 'connections',
      icon: 'tb-i-link',
      title: this.t.check,
      summary: this.t.connectionsSummary,
    },
    { id: 'ai', icon: 'tb-i-auto_awesome', title: this.t.ai, summary: this.t.aiSummary },
  ]);

  /** The result of a request to the AI as a tag, not the raw name of the status. */
  protected requestStatus(status: string): {
    label: string;
    severity: 'success' | 'danger' | 'warn' | 'secondary';
  } {
    switch (status) {
      case 'SUCCEEDED':
        return { label: T.integrations.done, severity: 'success' };
      case 'FAILED':
        return { label: T.integrations.failed, severity: 'danger' };
      case 'REFUSED':
        return { label: T.integrations.refused, severity: 'warn' };
      default:
        return { label: status, severity: 'secondary' };
    }
  }

  private readonly api = inject(AdminApi);

  protected readonly tags = INTEGRATION_TAGS;
  protected readonly checks = signal<IntegrationStatus[] | null>(null);
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ai = signal<AiStatus | null>(null);
  protected readonly usage = signal<AiUsage | null>(null);
  /** Requests shown in the log: the first page and those added by «Показать ещё». */
  protected readonly recent = signal<AiRequest[]>([]);
  protected readonly moreRecent = signal(false);
  protected readonly loadingMore = signal(false);

  protected readonly aiState = new LoadState();

  constructor() {
    pageDetail(() => (this.layout.detail() ? this.currentTitle() : null));
  }

  ngOnInit(): void {
    this.check();
    this.loadAi();
  }

  protected loadAi(): void {
    forkJoin({ status: this.api.aiStatus(), usage: this.api.aiUsage() })
      .pipe(this.aiState.track())
      .subscribe(({ status, usage }) => {
        this.ai.set(status);
        this.usage.set(usage);
        this.recent.set(usage.recent);
        this.moreRecent.set(usage.moreRecent);
      });
  }

  protected showMore(month: string): void {
    if (this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.api.aiRequests(month, this.recent().length).subscribe({
      next: (page) => {
        this.loadingMore.set(false);
        this.recent.update((recent) => [...recent, ...page.items]);
        this.moreRecent.set(page.hasMore);
      },
      error: () => {
        this.loadingMore.set(false);
      },
    });
  }

  check(): void {
    this.checking.set(true);
    this.error.set(null);
    this.api.checkIntegrations().subscribe({
      next: (checks) => {
        this.checking.set(false);
        this.checks.set(checks);
      },
      error: (error: unknown) => {
        this.checking.set(false);
        this.error.set(describeError(error, T.integrations.checkFailed));
      },
    });
  }
}
