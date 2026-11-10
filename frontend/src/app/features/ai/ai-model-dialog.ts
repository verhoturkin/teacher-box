import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Snackbar } from '@core/snackbar/snackbar';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { AiApi } from './data-access/ai-api';
import { AiModel, AiProvider } from './data-access/ai.models';
import { T } from './i18n/texts';
import { AiSetup } from './ai-setup';

/** The efforts Anthropic takes, lowest first (`AiModel.EFFORTS`). */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

/**
 * «Изменить» of a model (ADR-0057): its name and id; under «Дополнительно» the effort and the
 * fallbacks (Anthropic only), the answer length and the timeout.
 */
@Component({
  selector: 'tb-ai-model-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Checkbox,
    InputNumber,
    InputText,
    Select,
    TbDialog,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.title"
      [confirmLabel]="t.save"
      formId="ai-model-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="ai-model-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field">
          <label for="ai-model-label">{{ t.label }}</label>
          <input pInputText id="ai-model-label" formControlName="label" autocomplete="off" />
          <small class="tb-hint">{{ t.labelHint }}</small>
        </div>
        <div class="tb-field">
          <label for="ai-model-id">{{ t.modelId }}</label>
          <input pInputText id="ai-model-id" formControlName="modelId" autocomplete="off" />
        </div>
        <p-button
          class="tb-ai-model__more"
          [label]="t.more"
          [icon]="moreOpen() ? 'tb-i tb-i-expand_less' : 'tb-i tb-i-expand_more'"
          [text]="true"
          [attr.aria-expanded]="moreOpen()"
          (onClick)="moreOpen.set(!moreOpen())"
        />
        @if (moreOpen()) {
          @if (anthropic()) {
            <div class="tb-field">
              <label for="ai-model-effort">{{ t.effort }}</label>
              <p-select
                inputId="ai-model-effort"
                formControlName="effort"
                [options]="efforts"
                optionLabel="label"
                optionValue="value"
                [fluid]="true"
                appendTo="body"
              />
              <small class="tb-hint">{{ t.effortHint }}</small>
            </div>
            <div class="tb-ai-model__check">
              <p-checkbox
                [binary]="true"
                inputId="ai-model-fallbacks"
                formControlName="fallbacks"
              />
              <span>
                <label for="ai-model-fallbacks">{{ t.fallbacks }}</label>
                <small class="tb-hint">{{ t.fallbacksHint }}</small>
              </span>
            </div>
          }
          <div class="tb-ai-model__pair">
            <div class="tb-field">
              <label for="ai-model-tokens">{{ t.maxTokens }}</label>
              <p-inputnumber
                inputId="ai-model-tokens"
                formControlName="maxTokens"
                [min]="1"
                [fluid]="true"
              />
            </div>
            <div class="tb-field">
              <label for="ai-model-timeout">{{ t.timeout }}</label>
              <p-inputnumber
                inputId="ai-model-timeout"
                formControlName="timeoutSeconds"
                [min]="1"
                [max]="600"
                [fluid]="true"
              />
            </div>
          </div>
        }
      </form>
    </tb-dialog>
  `,
  styles: `
    .tb-ai-model__more {
      align-self: flex-start;
    }

    .tb-ai-model__check {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-3);

      > span {
        display: flex;
        flex-direction: column;
        gap: var(--tb-space-1);
      }
    }

    .tb-ai-model__pair {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
      gap: var(--tb-space-4);
    }
  `,
})
export class AiModelDialog {
  protected readonly t = T.modelDialog;
  private readonly api = inject(AiApi);
  private readonly setup = inject(AiSetup);
  private readonly snackbar = inject(Snackbar);

  protected readonly efforts = [
    { value: '', label: T.modelDialog.effortDefault },
    ...EFFORTS.map((effort) => ({ value: effort, label: T.efforts[effort] })),
  ];
  readonly visible = signal(false);
  protected readonly moreOpen = signal(false);
  protected readonly anthropic = signal(false);
  private readonly editing = signal<{ provider: AiProvider; model: AiModel } | null>(null);

  readonly form = new FormGroup({
    label: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    modelId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    effort: new FormControl('', { nonNullable: true }),
    fallbacks: new FormControl(true, { nonNullable: true }),
    maxTokens: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    timeoutSeconds: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(600),
    ]),
  });

  open(provider: AiProvider, model: AiModel): void {
    this.editing.set({ provider, model });
    this.anthropic.set(provider.kind === 'anthropic');
    this.moreOpen.set(false);
    this.visible.set(true);
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.modelDialog.failed,
    reset: () => {
      const model = this.editing()?.model;
      this.form.reset({
        label: model?.label ?? '',
        modelId: model?.modelId ?? '',
        effort: model?.effort ?? '',
        fallbacks: model?.fallbacks ?? true,
        maxTokens: model?.maxTokens ?? null,
        timeoutSeconds: model?.timeoutSeconds ?? null,
      });
    },
    request: (value) => {
      const editing = this.editing();
      if (editing === null) {
        throw new Error('No model to change');
      }
      return this.api.updateModel(editing.provider.id, editing.model.id, {
        modelId: value.modelId.trim(),
        label: value.label.trim() === '' ? null : value.label.trim(),
        effort: value.effort === '' ? null : value.effort,
        fallbacks: value.fallbacks,
        maxTokens: value.maxTokens ?? editing.model.maxTokens,
        timeoutSeconds: value.timeoutSeconds ?? editing.model.timeoutSeconds,
        version: editing.model.version,
      });
    },
    done: (saved) => {
      this.setup.putModel(saved);
      this.snackbar.success(T.modelDialog.saved);
    },
  });
}
