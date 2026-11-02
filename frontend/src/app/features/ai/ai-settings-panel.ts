import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { locale } from '@core/i18n/language';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { AiApi } from './data-access/ai-api';
import { AiFeature, AiStatus, UsageReport } from './data-access/ai.models';
import { EmptyState } from '@shared/ui/empty-state';
import { ProgressLabel } from '@shared/ui/progress-label.directive';
import { T } from './i18n/texts';
import { PromptLibraryCard } from './prompt-library-card';
import { SystemPromptsCard } from './system-prompts-card';

export const FEATURE_LABELS: Record<AiFeature, string> = T.features;

/**
 * The settings category «ИИ-помощник» (redesign spec §10.3): whether the assistant is configured, how many
 * tokens it used this month, the library of prompts (the editor's «Промты» menu leads here) and the system
 * prompts.
 */
@Component({
  selector: 'tb-ai-settings-panel',
  imports: [
    DecimalPipe,
    Card,
    ProgressBar,
    Tag,
    EmptyState,
    ProgressLabel,
    PromptLibraryCard,
    SystemPromptsCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status(); as status) {
      @if (!status.enabled) {
        <p-card>
          <tb-empty-state
            icon="tb-i-auto_awesome"
            [title]="t.notConfigured"
            [hint]="t.notConfiguredHint"
          />
        </p-card>
      } @else {
        <div class="tb-ai">
          <p-card [header]="t.model">
            <ul class="tb-list">
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i tb-i-auto_awesome"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ status.model }}</span>
                  <span class="tb-list__supporting">{{ t.byAdmin }}</span>
                </div>
                <div class="tb-list__trail">
                  <p-tag [value]="t.working" severity="success" />
                </div>
              </li>
            </ul>
            @if (report(); as report) {
              @if (report.monthlyTokenLimit > 0) {
                <p class="tb-ai__usage">
                  <strong class="tb-ai__percent">{{ percent(report.usedTokens) }} %</strong>
                  <span class="tb-muted"
                    >{{ t.ofMonthLimit }} · {{ t.resets }} {{ resetDay(report.month) }}</span
                  >
                </p>
                <p-progressbar
                  [value]="percent(report.usedTokens)"
                  [showValue]="false"
                  styleClass="tb-usage-bar"
                  [tbProgressLabel]="t.used"
                />
              } @else {
                <p class="tb-ai__usage">
                  <strong class="tb-ai__percent">{{ report.usedTokens | number }}</strong>
                  <span class="tb-muted">{{ t.tokensNoLimit }}</span>
                </p>
              }
              @if (mostly(report); as mostly) {
                <p class="tb-muted">{{ t.mostly(mostly) }}</p>
              }
            }
          </p-card>
          <tb-prompt-library-card><tb-system-prompts-card /></tb-prompt-library-card>
        </div>
      }
    }
  `,
  styles: `
    /* the sketch Ai: the model and the prompts side by side while they fit */
    .tb-ai {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
      align-items: start;
      gap: var(--tb-space-4);
    }

    .tb-ai__usage {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--tb-space-2);
      margin: var(--tb-space-3) 0 0;
    }

    /* our decision: the share of the limit is the card's headline number, M3 headline small */
    .tb-ai__percent {
      font: var(--tb-type-headline-s);
    }
  `,
})
export class AiSettingsPanel implements OnInit {
  protected readonly t = T.usage;
  private readonly api = inject(AiApi);

  protected readonly status = signal<AiStatus | null>(null);
  protected readonly report = signal<UsageReport | null>(null);

  ngOnInit(): void {
    this.api.status().subscribe((status) => {
      this.status.set(status);
      if (status.enabled) {
        this.api.usage().subscribe((report) => {
          this.report.set(report);
        });
      }
    });
  }

  protected percent(tokens: number): number {
    const limit = this.report()?.monthlyTokenLimit ?? 0;
    return limit === 0 ? 0 : Math.min(100, Math.round((tokens / limit) * 100));
  }

  /** «1 октября»: the day after the report's month, when the limit starts over. */
  protected resetDay(yearMonth: string): string {
    const [year = 0, month = 1] = yearMonth.split('-').map(Number);
    return new Date(year, month, 1).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  }

  /** «Черновик задания (21 %), Черновик проверки (11 %)»: the features by the share of the limit. */
  protected mostly(report: UsageReport): string {
    return report.features
      .map((feature) => ({ ...feature, tokens: feature.inputTokens + feature.outputTokens }))
      .filter((feature) => feature.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 2)
      .map(
        (feature) =>
          `${FEATURE_LABELS[feature.feature]} (${String(this.percent(feature.tokens))} %)`,
      )
      .join(', ');
  }
}
