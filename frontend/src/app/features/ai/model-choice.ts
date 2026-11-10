import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { problemCode } from '@core/http/problem-detail';
import {
  readDeviceSetting,
  removeDeviceSetting,
  writeDeviceSetting,
} from '@shared/storage/device-settings';
import { AiApi } from './data-access/ai-api';
import { AiModel, AiProvider } from './data-access/ai.models';

/** The model this device writes with (ADR-0057), an `ai.models` id. */
export const MODEL_CHOICE_KEY = 'tb.ai.model';

/**
 * The model the AI writes with on this device (ADR-0057): the teacher picks one beside
 * «Сгенерировать», and every surface that drafts (the assignment, the review, the lesson summary)
 * sends it. No choice — the default model, chosen by the server. A choice of a model that is gone
 * (removed in Settings, or the server answers 409 `ai.model.unknown`) is forgotten.
 */
@Injectable({ providedIn: 'root' })
export class AiModelChoice {
  private readonly api = inject(AiApi);
  private loading = false;
  private loaded = false;

  /** The connections with their models; empty until loaded or when the list cannot be read. */
  readonly providers = signal<readonly AiProvider[]>([]);
  private readonly stored = signal(readDeviceSetting(MODEL_CHOICE_KEY));
  /** Every model of every connection, in their order. */
  readonly models = computed(() => this.providers().flatMap((provider) => provider.models));
  /** The model of a request that names none. */
  readonly defaultModel = computed(() => this.models().find((model) => model.default) ?? null);
  /** The model the device picked, while it is there and its connection works. */
  private readonly picked = computed(() => {
    const id = this.stored();
    const provider = this.providers().find((candidate) =>
      candidate.models.some((model) => model.id === id),
    );
    return provider === undefined || provider.state === 'FAILED'
      ? null
      : (provider.models.find((model) => model.id === id) ?? null);
  });
  /** The model the next request is written with. */
  readonly chosen = computed<AiModel | null>(() => this.picked() ?? this.defaultModel());

  /**
   * Reads the connections once: the pickers share them. Settings forget them on leaving
   * (`invalidate`), so a picker shown after a change reads them anew.
   */
  load(): void {
    if (this.loading || this.loaded) {
      return;
    }
    this.loading = true;
    this.api.providers().subscribe({
      next: (providers) => {
        this.loading = false;
        this.loaded = true;
        this.providers.set(providers);
        const id = this.stored();
        if (id !== null && !providers.some((p) => p.models.some((model) => model.id === id))) {
          this.forget();
        }
      },
      error: () => {
        // without the list the picker stays hidden and the default model writes
        this.loading = false;
      },
    });
  }

  /** The connections may have changed: the next picker reads them anew. */
  invalidate(): void {
    this.loaded = false;
  }

  /** The default model is not stored: the device follows the default when it changes. */
  choose(model: AiModel): void {
    if (model.default) {
      this.forget();
    } else {
      this.stored.set(model.id);
      writeDeviceSetting(MODEL_CHOICE_KEY, model.id);
    }
  }

  /**
   * Sends a request with the chosen model. When the server no longer knows it (409
   * `ai.model.unknown`: removed on another device), the choice is forgotten, the list read anew and
   * the request sent once more to the default model.
   */
  send<R>(request: (modelId: string | undefined) => Observable<R>): Observable<R> {
    const picked = this.picked()?.id;
    return request(picked).pipe(
      catchError((error: unknown) => {
        if (picked === undefined || problemCode(error) !== 'ai.model.unknown') {
          return throwError(() => error);
        }
        this.forget();
        this.invalidate();
        this.load();
        return request(undefined);
      }),
    );
  }

  private forget(): void {
    this.stored.set(null);
    removeDeviceSetting(MODEL_CHOICE_KEY);
  }
}
