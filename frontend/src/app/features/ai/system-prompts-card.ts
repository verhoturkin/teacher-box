import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';
import { DialogHeaderActions, TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { AiApi } from './data-access/ai-api';
import { SystemPrompt } from './data-access/ai.models';
import { T } from './i18n/texts';

/** The longest system prompt, as on the backend (`SystemPrompts.MAX_TEXT`). */
const MAX_TEXT = 10_000;

/** Whitespace only is as empty as nothing (the text is trimmed on save). */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/**
 * System prompts of the assistant on the AI page (ADR-0043): the rules of the homework and review
 * drafts, rewritten by the teacher or the standard ones.
 */
@Component({
  selector: 'tb-system-prompts-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    DialogHeaderActions,
    Menu,
    TbDialog,
    Tag,
    Textarea,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="system-prompts" [header]="t.title">
      <p class="tb-hint">{{ t.hint }}</p>
      <ul class="tb-list tb-list--no-phone-lead">
        @for (prompt of prompts(); track prompt.feature) {
          <li>
            <div class="tb-list__text">
              <span class="tb-list__title">
                {{ t.features[prompt.feature] }}
                @if (prompt.custom) {
                  <p-tag [value]="t.custom" severity="info" />
                }
              </span>
              <span class="tb-system-prompt-text">{{ prompt.text }}</span>
            </div>
            <div class="tb-list__trail tb-list__trail--icons">
              <p-button
                icon="tb-i tb-i-edit"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [ariaLabel]="t.edit(t.features[prompt.feature])"
                (onClick)="edit(prompt)"
              />
            </div>
          </li>
        }
      </ul>
    </p-card>

    <tb-dialog
      kind="form"
      width="wide"
      [(visible)]="visible"
      [headline]="header()"
      [confirmLabel]="t.save"
      formId="system-prompt-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      @if (editing()?.custom) {
        <ng-template tbDialogHeaderActions>
          <p-button
            icon="tb-i tb-i-more_vert"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [ariaLabel]="t.more"
            aria-haspopup="menu"
            [loading]="resetting()"
            (onClick)="menu.toggle($event)"
          />
          <p-menu #menu [model]="menuItems" [popup]="true" appendTo="body" />
        </ng-template>
      }
      <form
        tbFieldErrors
        id="system-prompt-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field tb-field--required">
          <label for="system-prompt-text">{{ t.text }}</label>
          <textarea
            pTextarea
            id="system-prompt-text"
            formControlName="text"
            rows="14"
            [autoResize]="true"
          ></textarea>
          <small class="tb-hint">{{ t.textHint }}</small>
        </div>
      </form>
    </tb-dialog>
  `,
  styles: `
    .tb-list__title {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-system-prompt-text {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
  `,
})
export class SystemPromptsCard implements OnInit {
  protected readonly t = T.systemPrompts;
  private readonly api = inject(AiApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);

  protected readonly prompts = signal<readonly SystemPrompt[]>([]);
  readonly editing = signal<SystemPrompt | null>(null);
  protected readonly header = computed(() => {
    const prompt = this.editing();
    return prompt === null ? '' : T.systemPrompts.features[prompt.feature];
  });
  readonly visible = signal(false);
  protected readonly resetting = signal(false);
  /** «Сбросить» destroys the teacher's text: red, behind a confirmation. */
  protected readonly menuItems: MenuItem[] = [
    {
      label: T.systemPrompts.reset,
      icon: 'tb-i tb-i-history',
      styleClass: 'tb-menu-item--danger',
      command: () => {
        void this.confirmReset();
      },
    },
  ];
  readonly form = new FormGroup({
    text: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(MAX_TEXT)],
    }),
  });

  ngOnInit(): void {
    this.api.systemPrompts().subscribe((prompts) => {
      this.prompts.set(prompts);
    });
  }

  edit(prompt: SystemPrompt): void {
    this.editing.set(prompt);
    this.visible.set(true);
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.systemPrompts.failed,
    reset: () => {
      this.form.reset({ text: this.editing()?.text ?? '' });
    },
    request: (value) => {
      const prompt = this.editing();
      return this.api.updateSystemPrompt(
        prompt?.feature ?? 'HOMEWORK_DRAFT',
        value.text.trim(),
        prompt?.version ?? 0,
      );
    },
    done: (saved) => {
      this.replace(saved);
      this.snackbar.success(T.systemPrompts.saved);
    },
  });

  protected async confirmReset(): Promise<void> {
    const prompt = this.editing();
    if (prompt === null) {
      return;
    }
    if (
      await this.confirm.danger({
        header: T.systemPrompts.resetHeader,
        message: T.systemPrompts.resetMessage,
        acceptLabel: T.systemPrompts.resetAccept,
      })
    ) {
      this.reset(prompt);
    }
  }

  private reset(prompt: SystemPrompt): void {
    this.resetting.set(true);
    this.api.resetSystemPrompt(prompt.feature).subscribe({
      next: (standard) => {
        this.resetting.set(false);
        this.visible.set(false);
        this.replace(standard);
        this.snackbar.success(T.systemPrompts.resetDone);
      },
      error: () => {
        this.resetting.set(false);
      },
    });
  }

  private replace(prompt: SystemPrompt): void {
    this.prompts.update((prompts) =>
      prompts.map((candidate) => (candidate.feature === prompt.feature ? prompt : candidate)),
    );
  }
}
