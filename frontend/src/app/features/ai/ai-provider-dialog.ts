import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Observable, catchError, concatMap, from, map, of, toArray } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { injectWindowSize } from '@core/layout/mobile';
import { Snackbar } from '@core/snackbar/snackbar';
import { TbDialog, DialogFooter } from '@shared/ui/dialog/dialog';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SearchField } from '@shared/ui/search-field';
import { AiApi } from './data-access/ai-api';
import {
  AiProvider,
  AvailableModel,
  ConnectionInput,
  ModelInput,
  ProviderKind,
} from './data-access/ai.models';
import { T } from './i18n/texts';
import { KIND_ADDRESSES, KIND_ICONS, PROVIDER_KINDS } from './ai-labels';
import { AiSetup } from './ai-setup';

const URL = /^https?:\/\/\S+$/;
const PROXY = /^(https?|socks5h?):\/\/[^\s/:@]+:\d{1,5}\/?$/;
/** The checklist shows this many models; the search narrows a long list (OpenRouter has hundreds). */
const SHOWN = 50;
const MAX_TOKENS = 16_000;
const TIMEOUT = 120;

/** What the dialog does: a new connection (both steps), a change of one (step 1), its models (step 2). */
type Mode = 'new' | 'edit' | 'models';

/** A row of the checklist: offered by the provider or typed by hand. */
interface Choice {
  readonly modelId: string;
  readonly label: string;
  readonly added: boolean;
}

/**
 * The dialog of a connection (sketch AiProviderDialog, ADR-0057): step 1 — the provider as a grid of
 * cards, the name, the key, the address (shown for an OpenAI-compatible server, under «Дополнительно»
 * for the others) and the proxy, «Проверить и продолжить»; step 2 — the provider's models as a
 * checklist with a search and «Добавить модель вручную». A failed check stays on step 1 with the
 * provider's answer under the key. Full screen on a phone (the `form` kind).
 */
@Component({
  selector: 'tb-ai-provider-dialog',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Checkbox,
    InputText,
    Message,
    TbDialog,
    DialogFooter,
    FieldErrors,
    SearchField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      width="wide"
      [(visible)]="visible"
      [headline]="headline()"
      [confirmLabel]="confirmLabel()"
      [formId]="step() === 1 ? 'ai-provider-form' : undefined"
      [pending]="pending()"
      [error]="error()"
      [dirty]="form.dirty || chosen().size > 0"
      (confirm)="saveModels()"
    >
      @if (step() === 2 && mode() === 'new') {
        <ng-template tbDialogFooter>
          <p-button [label]="t.back" severity="secondary" [text]="true" (onClick)="back()" />
          @if (!compact()) {
            <p-button [label]="confirmLabel()" [loading]="pending()" (onClick)="saveModels()" />
          }
        </ng-template>
      }
      @if (mode() !== 'edit') {
        <span class="tb-ai-dialog__step">{{ step() === 1 ? t.step1 : t.step2 }}</span>
      }
      @if (step() === 1) {
        <form
          tbFieldErrors
          id="ai-provider-form"
          class="tb-form"
          [formGroup]="form"
          (ngSubmit)="submitConnection()"
        >
          @if (mode() === 'new') {
            <p class="tb-muted">{{ t.keyWhere }}</p>
            <div class="tb-ai-kinds" role="radiogroup" [attr.aria-label]="t.kind">
              @for (option of kinds; track option) {
                <label class="tb-ai-kind" [class.tb-ai-kind--on]="option === kind()">
                  <input
                    type="radio"
                    name="ai-kind"
                    class="tb-ai-kind__input"
                    [value]="option"
                    [checked]="option === kind()"
                    (change)="pick(option)"
                  />
                  <i class="tb-i {{ icons[option] }}" aria-hidden="true"></i>
                  <span class="tb-ai-kind__text">
                    <b>{{ kindTexts[option].name }}</b>
                    <small>{{ kindTexts[option].sub }}</small>
                  </span>
                </label>
              }
            </div>
          }
          <div class="tb-field">
            <label for="ai-provider-name">{{ t.name }}</label>
            <input pInputText id="ai-provider-name" formControlName="name" autocomplete="off" />
            <small class="tb-hint">{{ t.nameHint }}</small>
          </div>
          <div class="tb-field">
            <label for="ai-provider-key">{{ t.apiKey }}</label>
            <input
              pInputText
              id="ai-provider-key"
              type="password"
              formControlName="apiKey"
              autocomplete="off"
            />
            <small class="tb-hint">{{ keyHint() }}</small>
          </div>
          @if (mode() === 'edit' && editing()?.keySet && kind() === 'openai-compatible') {
            <div class="tb-ai-dialog__check">
              <p-checkbox
                [binary]="true"
                inputId="ai-provider-remove-key"
                formControlName="removeKey"
              />
              <label for="ai-provider-remove-key">{{ t.removeKey }}</label>
            </div>
          }
          @if (kind() === 'openai-compatible') {
            <ng-container *ngTemplateOutlet="address" />
          } @else {
            <p-button
              class="tb-ai-dialog__more"
              [label]="t.more"
              [icon]="moreOpen() ? 'tb-i tb-i-expand_less' : 'tb-i tb-i-expand_more'"
              [text]="true"
              [attr.aria-expanded]="moreOpen()"
              (onClick)="moreOpen.set(!moreOpen())"
            />
          }
          @if (moreOpen() || kind() === 'openai-compatible') {
            @if (kind() !== 'openai-compatible') {
              <ng-container *ngTemplateOutlet="address" />
            }
            <div class="tb-field">
              <label for="ai-provider-proxy">{{ t.proxy }}</label>
              <input
                pInputText
                id="ai-provider-proxy"
                formControlName="proxy"
                autocomplete="off"
                placeholder="socks5://host.docker.internal:1080"
              />
              <small class="tb-hint">{{ t.proxyHint }}</small>
            </div>
          }
          <ng-template #address>
            <div class="tb-field">
              <label for="ai-provider-url">{{ t.address }}</label>
              <input
                pInputText
                id="ai-provider-url"
                formControlName="baseUrl"
                autocomplete="off"
                [placeholder]="editing()?.address ?? addresses[kind()]"
              />
              <small class="tb-hint">{{
                kind() === 'openai-compatible' ? t.addressRequired : t.addressHint
              }}</small>
            </div>
          </ng-template>
        </form>
      } @else {
        @if (loadingModels()) {
          <p class="tb-muted">…</p>
        } @else {
          @if (worksNote(); as note) {
            <p-message
              severity="success"
              icon="tb-i tb-i-check_circle"
              styleClass="tb-form-message"
              >{{ note }}</p-message
            >
          }
          @if (choices().length > 0) {
            <tb-search-field
              [label]="t.search"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
            />
            @if (shown().length === 0) {
              <p class="tb-muted">{{ t.nothingFound }}</p>
            } @else {
              <ul
                class="tb-list tb-list--own-trail tb-ai-dialog__models"
                [attr.aria-label]="headline()"
              >
                @for (choice of shown(); track choice.modelId) {
                  <li>
                    <p-checkbox
                      class="tb-list__lead tb-ai-dialog__box"
                      [binary]="true"
                      [inputId]="'ai-model-' + $index"
                      [ngModel]="choice.added || chosen().has(choice.modelId)"
                      (ngModelChange)="toggle(choice.modelId, $event)"
                      [disabled]="choice.added"
                    />
                    <label class="tb-list__text" [for]="'ai-model-' + $index">
                      <span class="tb-list__title">{{ choice.label }}</span>
                      @if (choice.added || choice.label !== choice.modelId) {
                        <span class="tb-list__supporting">{{ choiceHint(choice) }}</span>
                      }
                    </label>
                  </li>
                }
              </ul>
              @if (hidden() > 0) {
                <p class="tb-muted">{{ t.moreFound(hidden()) }}</p>
              }
            }
          }
          @if (manualOpen() || choices().length === 0) {
            <div class="tb-ai-dialog__manual">
              <div class="tb-field">
                <label for="ai-model-manual">{{ t.manualId }}</label>
                <input
                  pInputText
                  id="ai-model-manual"
                  autocomplete="off"
                  [formControl]="manual"
                  (keydown.enter)="$event.preventDefault(); addManual()"
                />
                <small class="tb-hint">{{ t.manualHint }}</small>
              </div>
              <p-button
                [label]="t.manualAdd"
                icon="tb-i tb-i-add"
                severity="secondary"
                (onClick)="addManual()"
              />
            </div>
          } @else {
            <p-button
              class="tb-ai-dialog__more"
              [label]="t.addManually"
              icon="tb-i tb-i-add"
              [text]="true"
              (onClick)="manualOpen.set(true)"
            />
          }
          <p class="tb-muted tb-ai-dialog__note">{{ t.shownLater }}</p>
        }
      }
    </tb-dialog>
  `,
  styles: `
    /* the sketch's overline «Шаг 1 из 2 · Подключение»: M3 label medium, on-surface-variant */
    .tb-ai-dialog__step {
      display: block;
      margin-block-end: var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* the kinds as selectable cards (sketch): two columns, one on a phone; ours — M3 publishes no
       selectable card grid, so outlined cards of 64 dp with secondary container when chosen */
    .tb-ai-kinds {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
      gap: var(--tb-space-2);
    }

    .tb-ai-kind {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-block-size: 4rem;
      box-sizing: border-box;
      padding: var(--tb-space-3);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-l, 1rem);
      cursor: pointer;
      transition: background var(--tb-spring-fast-effects);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
      }

      &:has(:focus-visible) {
        outline: 2px solid var(--p-md-primary);
        outline-offset: 2px;
      }

      > .tb-i {
        color: var(--p-md-primary);
        font-size: 1.5rem;
      }
    }

    .tb-ai-kind--on,
    .tb-ai-kind--on:hover {
      border-color: var(--p-md-secondary-container);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-ai-kind__input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .tb-ai-kind__text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      > b {
        font: var(--tb-type-label-l);
      }

      > small {
        color: var(--p-md-on-surface-variant);
        font: var(--tb-type-body-s);
      }
    }

    .tb-ai-dialog__check {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-ai-dialog__more {
      align-self: flex-start;
    }

    /* the checkbox stands where a lead icon would (40 px column), the label covers the row */
    .tb-ai-dialog__box {
      background: none;
    }

    .tb-ai-dialog__models :is(.tb-list__title, .tb-list__supporting) {
      overflow-wrap: anywhere;
    }

    .tb-ai-dialog__models > li {
      cursor: pointer;
    }

    .tb-ai-dialog__models label {
      cursor: inherit;
    }

    .tb-ai-dialog__manual {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--tb-space-2) var(--tb-space-3);

      > .tb-field {
        flex: 1 1 16rem;
      }

      > p-button {
        margin-block-start: var(--tb-space-2);
      }
    }

    .tb-ai-dialog__note {
      font: var(--tb-type-body-s);
    }

    tb-search-field,
    p-message {
      display: block;
    }
  `,
})
export class AiProviderDialog {
  protected readonly t = T.providerDialog;
  protected readonly kindTexts = T.kinds;
  protected readonly kinds = PROVIDER_KINDS;
  protected readonly icons = KIND_ICONS;
  protected readonly addresses = KIND_ADDRESSES;
  private readonly api = inject(AiApi);
  private readonly setup = inject(AiSetup);
  private readonly snackbar = inject(Snackbar);
  private readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');

  readonly visible = signal(false);
  protected readonly mode = signal<Mode>('new');
  protected readonly step = signal<1 | 2>(1);
  protected readonly kind = signal<ProviderKind>('anthropic');
  /** The connection being changed or given models; `null` for a new one. */
  protected readonly editing = signal<AiProvider | null>(null);
  protected readonly moreOpen = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly choices = signal<readonly Choice[]>([]);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly search = signal('');
  protected readonly manualOpen = signal(false);
  protected readonly loadingModels = signal(false);
  /** What the check said on step 2: «Подключение работает…»; `null` when the list was not checked. */
  protected readonly worksNote = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    apiKey: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    removeKey: new FormControl(false, { nonNullable: true }),
    baseUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500), Validators.pattern(URL)],
    }),
    proxy: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500), Validators.pattern(PROXY)],
    }),
  });
  protected readonly manual = new FormControl('', { nonNullable: true });

  protected readonly headline = computed(() => {
    const editing = this.editing();
    if (this.step() === 2) {
      return this.t.modelsTitle(editing?.name ?? this.connectionName());
    }
    return editing === null ? this.t.newTitle : this.t.editTitle(editing.name);
  });

  protected readonly confirmLabel = computed(() => {
    if (this.step() === 2) {
      return this.t.saveModels(this.chosen().size);
    }
    return this.mode() === 'new' ? this.t.checkAndContinue : this.t.save;
  });

  protected readonly keyHint = computed(() => {
    const editing = this.editing();
    if (editing?.keySet === true) {
      return editing.keyEnding === null
        ? this.t.apiKeyKeptShort
        : this.t.apiKeyKept(editing.keyEnding);
    }
    return this.kind() === 'openai-compatible' ? this.t.apiKeyOptional : '';
  });

  private readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return query === ''
      ? this.choices()
      : this.choices().filter(
          (choice) =>
            choice.modelId.toLowerCase().includes(query) ||
            choice.label.toLowerCase().includes(query),
        );
  });
  protected readonly shown = computed(() => this.filtered().slice(0, SHOWN));
  protected readonly hidden = computed(() => this.filtered().length - this.shown().length);

  /** «Уже добавлена · deepseek/deepseek-v4»: the id under a label that differs from it. */
  protected choiceHint(choice: Choice): string {
    const id = choice.label === choice.modelId ? null : choice.modelId;
    return choice.added ? [this.t.added, id].filter(Boolean).join(' · ') : (id ?? '');
  }

  /** A new connection: step 1 with Anthropic chosen. */
  openNew(): void {
    this.reset('new', null, 'anthropic');
    this.visible.set(true);
  }

  /** A saved connection's name, key, address and proxy. */
  openEdit(provider: AiProvider): void {
    this.reset('edit', provider, provider.kind);
    this.form.reset({
      name: provider.name,
      apiKey: '',
      removeKey: false,
      baseUrl: provider.baseUrl ?? '',
      proxy: provider.proxy ?? '',
    });
    this.moreOpen.set(provider.baseUrl !== null || provider.proxy !== null);
    this.visible.set(true);
  }

  /** More models of a saved connection: step 2 with the provider's list. */
  openModels(provider: AiProvider): void {
    this.reset('models', provider, provider.kind);
    this.step.set(2);
    this.visible.set(true);
    this.loadingModels.set(true);
    this.api.availableModels(provider.id).subscribe({
      next: (models) => {
        this.loadingModels.set(false);
        this.showModels(models, provider);
      },
      error: (error: unknown) => {
        this.loadingModels.set(false);
        this.error.set(describeError(error, this.t.failed));
        this.showModels([], provider, false);
      },
    });
  }

  protected pick(kind: ProviderKind): void {
    this.kind.set(kind);
    this.form.controls.apiKey.setErrors(null);
    this.form.markAsDirty();
    this.requireFor(kind);
  }

  protected back(): void {
    this.step.set(1);
    this.error.set(null);
  }

  protected toggle(modelId: string, on: boolean): void {
    this.chosen.update((chosen) => {
      const next = new Set(chosen);
      if (on) {
        next.add(modelId);
      } else {
        next.delete(modelId);
      }
      return next;
    });
  }

  protected addManual(): void {
    const modelId = this.manual.value.trim();
    if (modelId === '') {
      return;
    }
    if (!this.choices().some((choice) => choice.modelId === modelId)) {
      this.choices.update((choices) => [{ modelId, label: modelId, added: false }, ...choices]);
    }
    if (!this.choices().some((choice) => choice.modelId === modelId && choice.added)) {
      this.toggle(modelId, true);
    }
    this.manual.reset('');
    this.search.set('');
    this.manualOpen.set(true);
  }

  /** Step 1: a new connection is checked before step 2, a saved one is saved and checked. */
  protected submitConnection(): void {
    // the provider's last answer is not a rule of the field: a new attempt checks again
    this.form.controls.apiKey.updateValueAndValidity();
    if (this.pending() || !revealErrors(this.form)) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    const editing = this.editing();
    if (editing === null) {
      this.api.checkConnection(this.input()).subscribe({
        next: (result) => {
          this.pending.set(false);
          if (result.state === 'FAILED') {
            this.keyFailed(result.detail);
            return;
          }
          this.step.set(2);
          this.showModels(result.models, null);
        },
        error: (error: unknown) => {
          this.failed(error);
        },
      });
      return;
    }
    const value = this.form.getRawValue();
    this.api
      .updateProvider(editing.id, {
        name: value.name.trim() === '' ? editing.name : value.name.trim(),
        apiKey: blankToNull(value.apiKey),
        removeKey: value.removeKey,
        baseUrl: blankToNull(value.baseUrl),
        proxy: blankToNull(value.proxy),
        version: editing.version,
      })
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.setup.put(saved);
          this.editing.set(saved);
          if (saved.state === 'FAILED') {
            this.form.markAsPristine();
            this.keyFailed(saved.stateDetail);
            return;
          }
          this.visible.set(false);
          this.snackbar.success(this.t.saved);
        },
        error: (error: unknown) => {
          this.failed(error);
        },
      });
  }

  /** Step 2: a new connection is saved first, then each chosen model in the list's order. */
  protected saveModels(): void {
    if (this.pending() || this.step() !== 2) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    const editing = this.editing();
    const provider$: Observable<AiProvider> =
      editing === null ? this.api.createProvider(this.input()) : of(editing);
    const order = this.choices().filter((choice) => this.chosen().has(choice.modelId));
    provider$.subscribe({
      next: (provider) => {
        this.editing.set(provider);
        this.mode.set('models');
        this.addModels(provider, order).subscribe((allAdded) => {
          this.pending.set(false);
          this.visible.set(false);
          this.setup.load();
          if (allAdded) {
            this.snackbar.success(this.t.saved);
          } else {
            this.snackbar.error(this.t.modelsFailed);
          }
        });
      },
      error: (error: unknown) => {
        this.failed(error);
      },
    });
  }

  private addModels(provider: AiProvider, choices: readonly Choice[]): Observable<boolean> {
    if (choices.length === 0) {
      return of(true);
    }
    return from(choices).pipe(
      concatMap((choice) =>
        this.api.addModel(provider.id, modelInput(choice)).pipe(
          map(() => true),
          catchError(() => of(false)),
        ),
      ),
      toArray(),
      map((results) => results.every(Boolean)),
    );
  }

  private showModels(
    models: readonly AvailableModel[],
    provider: AiProvider | null,
    ok = true,
  ): void {
    const added = new Set(provider?.models.map((model) => model.modelId) ?? []);
    this.choices.set(
      models.map((model) => ({
        modelId: model.modelId,
        label: model.label,
        added: model.added || added.has(model.modelId),
      })),
    );
    this.chosen.set(new Set());
    this.search.set('');
    this.worksNote.set(ok ? this.t.works(models.length) : null);
  }

  private keyFailed(detail: string | null): void {
    const message = this.t.keyFailed(this.connectionName(), detail ?? '');
    this.form.controls.apiKey.setErrors({ server: message });
    this.form.controls.apiKey.markAsTouched();
  }

  private failed(error: unknown): void {
    this.pending.set(false);
    this.error.set(
      error instanceof HttpErrorResponse ? describeError(error, this.t.failed) : this.t.failed,
    );
  }

  private connectionName(): string {
    const name = this.form.controls.name.value.trim();
    return name === '' ? this.kindTexts[this.kind()].name : name;
  }

  private input(): ConnectionInput {
    const value = this.form.getRawValue();
    return {
      kind: this.kind(),
      name: blankToNull(value.name),
      apiKey: blankToNull(value.apiKey),
      baseUrl: blankToNull(value.baseUrl),
      proxy: blankToNull(value.proxy),
    };
  }

  private reset(mode: Mode, provider: AiProvider | null, kind: ProviderKind): void {
    this.mode.set(mode);
    this.editing.set(provider);
    this.kind.set(kind);
    this.step.set(1);
    this.pending.set(false);
    this.error.set(null);
    this.moreOpen.set(false);
    this.manualOpen.set(false);
    this.choices.set([]);
    this.chosen.set(new Set());
    this.search.set('');
    this.worksNote.set(null);
    this.manual.reset('');
    this.form.reset();
    this.requireFor(kind);
  }

  /** A key is required by every kind but a local server, unless a saved one stays; an address by the latter. */
  private requireFor(kind: ProviderKind): void {
    const { apiKey, baseUrl } = this.form.controls;
    const keyKept = this.editing()?.keySet === true;
    if (kind !== 'openai-compatible' && !keyKept) {
      apiKey.addValidators(Validators.required);
    } else {
      apiKey.removeValidators(Validators.required);
    }
    if (kind === 'openai-compatible') {
      baseUrl.addValidators(Validators.required);
    } else {
      baseUrl.removeValidators(Validators.required);
    }
    apiKey.updateValueAndValidity({ emitEvent: false });
    baseUrl.updateValueAndValidity({ emitEvent: false });
  }
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function modelInput(choice: Choice): ModelInput {
  return {
    modelId: choice.modelId,
    label: choice.label === choice.modelId ? null : choice.label,
    effort: null,
    fallbacks: true,
    maxTokens: MAX_TOKENS,
    timeoutSeconds: TIMEOUT,
  };
}
