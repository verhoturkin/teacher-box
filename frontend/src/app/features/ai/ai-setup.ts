import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, tap } from 'rxjs';
import { LoadState } from '@shared/ui/load-state';
import { AiApi } from './data-access/ai-api';
import { AiModel, AiProvider, AiSettings } from './data-access/ai.models';
import { AiModelChoice } from './model-choice';

/**
 * The connections, their models, the default model and the limit that the cards of «ИИ-помощник»
 * share (ADR-0057): one load, and every change keeps them in step. Provided by `AiSettingsPanel`.
 */
@Injectable()
export class AiSetup {
  private readonly api = inject(AiApi);

  readonly state = new LoadState();
  readonly providers = signal<readonly AiProvider[]>([]);
  readonly settings = signal<AiSettings | null>(null);
  /** Every model of every connection, in their order. */
  readonly models = computed(() => this.providers().flatMap((provider) => provider.models));

  constructor() {
    // the model pickers read the connections anew after the teacher was here
    const choice = inject(AiModelChoice);
    inject(DestroyRef).onDestroy(() => {
      choice.invalidate();
    });
  }

  load(): void {
    forkJoin({ providers: this.api.providers(), settings: this.api.settings() })
      .pipe(this.state.track())
      .subscribe(({ providers, settings }) => {
        this.providers.set(providers);
        this.settings.set(settings);
      });
  }

  /** A saved or rechecked connection in place of the old one, or a new one at the end. */
  put(provider: AiProvider): void {
    this.providers.update((providers) =>
      providers.some((candidate) => candidate.id === provider.id)
        ? providers.map((candidate) => (candidate.id === provider.id ? provider : candidate))
        : [...providers, provider],
    );
  }

  /** A changed model in place of the old one. */
  putModel(model: AiModel): void {
    this.providers.update((providers) =>
      providers.map((provider) => ({
        ...provider,
        models: provider.models.map((candidate) => (candidate.id === model.id ? model : candidate)),
      })),
    );
  }

  remove(providerId: string): void {
    this.providers.update((providers) =>
      providers.filter((provider) => provider.id !== providerId),
    );
  }

  removeModel(modelId: string): void {
    this.providers.update((providers) =>
      providers.map((provider) => ({
        ...provider,
        models: provider.models.filter((model) => model.id !== modelId),
      })),
    );
    if (this.settings()?.defaultModelId === modelId) {
      this.settings.update((settings) =>
        settings === null ? null : { ...settings, defaultModelId: null },
      );
    }
  }

  /** Makes the model the default one; the rows follow the answer. */
  makeDefault(modelId: string): Observable<AiSettings> {
    return this.save({ defaultModelId: modelId });
  }

  /** No default model: the AI is off (the connection that held it is going). */
  clearDefault(): Observable<AiSettings> {
    return this.save({ defaultModelId: null });
  }

  /** @param limit tokens a month, 0 — no limit */
  saveLimit(limit: number): Observable<AiSettings> {
    return this.save({ monthlyTokenLimit: limit });
  }

  private save(change: Partial<AiSettings>): Observable<AiSettings> {
    const settings = this.settings() ?? { defaultModelId: null, monthlyTokenLimit: 0, version: 0 };
    return this.api.saveSettings({ ...settings, ...change }).pipe(
      tap((saved) => {
        this.settings.set(saved);
        this.providers.update((providers) =>
          providers.map((provider) => ({
            ...provider,
            models: provider.models.map((model) => ({
              ...model,
              default: model.id === saved.defaultModelId,
            })),
          })),
        );
      }),
    );
  }
}
