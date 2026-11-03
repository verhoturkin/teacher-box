import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
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
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { AiApi } from './data-access/ai-api';
import { SavedPrompt } from './data-access/ai.models';
import { T } from './i18n/texts';

/** Whitespace only is as empty as nothing (the texts are trimmed on save). */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/** The teacher's prompt library on the AI page: what is saved, renaming, rewording and deleting. */
@Component({
  selector: 'tb-prompt-library-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    Menu,
    TbDialog,
    InputText,
    Textarea,
    EmptyState,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="prompt-library" styleClass="tb-section-card tb-section-card--flow">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text">{{ t.title }}</span>
          <div class="tb-card-title__actions">
            <p-button
              [label]="t.create"
              icon="tb-i tb-i-add"
              severity="secondary"
              (onClick)="create()"
            />
          </div>
        </div>
      </ng-template>
      <p class="tb-muted">{{ t.hint }}</p>
      @if (prompts().length === 0) {
        <tb-empty-state
          [compact]="true"
          icon="tb-i-bookmark"
          [title]="t.empty"
          [hint]="t.emptyHint"
        />
      } @else {
        <ul class="tb-list" [attr.aria-label]="t.title">
          @for (prompt of prompts(); track prompt.id) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="tb-i tb-i-bookmark"></i
              ></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ prompt.title }}</span>
                <span class="tb-prompt-text">{{ prompt.text }}</span>
              </div>
              <div class="tb-list__trail tb-list__trail--icons">
                <p-button
                  icon="tb-i tb-i-more_vert"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [ariaLabel]="t.actions(prompt.title)"
                  aria-haspopup="menu"
                  (onClick)="openMenu(prompt, $event)"
                />
              </div>
            </li>
          }
        </ul>
      }
    </p-card>
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />

    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.editTitle"
      [confirmLabel]="t.save"
      formId="prompt-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="prompt-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field tb-field--required">
          <label for="prompt-title">{{ t.name }}</label>
          <input pInputText id="prompt-title" formControlName="title" autocomplete="off" />
        </div>
        <div class="tb-field tb-field--required">
          <label for="prompt-text">{{ t.text }}</label>
          <textarea pTextarea id="prompt-text" formControlName="text" rows="6"></textarea>
        </div>
      </form>
    </tb-dialog>
  `,
  styles: `
    .tb-prompt-text {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      white-space: pre-line;
    }
  `,
})
export class PromptLibraryCard implements OnInit {
  protected readonly t = T.library;
  private readonly api = inject(AiApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);

  protected readonly prompts = signal<readonly SavedPrompt[]>([]);
  private readonly menu = viewChild.required<Menu>('menu');
  /** The prompt whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<SavedPrompt | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const prompt = this.menuFor();
    return prompt === null
      ? []
      : [
          {
            label: T.library.editItem,
            icon: 'tb-i tb-i-edit',
            command: () => {
              this.edit(prompt);
            },
          },
          {
            label: T.library.deleteItem,
            icon: 'tb-i tb-i-delete',
            styleClass: 'tb-menu-item--danger',
            command: () => {
              void this.confirmDelete(prompt);
            },
          },
        ];
  });
  /** The prompt in the dialog; null for a new one. */
  readonly editing = signal<SavedPrompt | null>(null);
  readonly visible = signal(false);
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(100)],
    }),
    text: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(4_000)],
    }),
  });

  ngOnInit(): void {
    this.api.prompts().subscribe((prompts) => {
      this.prompts.set(prompts);
    });
  }

  protected openMenu(prompt: SavedPrompt, event: Event): void {
    this.menuFor.set(prompt);
    this.menu().toggle(event);
  }

  protected create(): void {
    this.edit(null);
  }

  edit(prompt: SavedPrompt | null): void {
    this.editing.set(prompt);
    this.visible.set(true);
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.library.failed,
    reset: () => {
      const prompt = this.editing();
      this.form.reset({ title: prompt?.title ?? '', text: prompt?.text ?? '' });
    },
    request: (value) => {
      const prompt = this.editing();
      const input = { title: value.title.trim(), text: value.text.trim() };
      return prompt === null
        ? this.api.savePrompt(input)
        : this.api.updatePrompt(prompt.id, input, prompt.version);
    },
    done: (saved) => {
      this.prompts.update((prompts) =>
        (prompts.some((candidate) => candidate.id === saved.id)
          ? prompts.map((candidate) => (candidate.id === saved.id ? saved : candidate))
          : [...prompts, saved]
        ).sort((a, b) => a.title.localeCompare(b.title)),
      );
    },
  });

  protected async confirmDelete(prompt: SavedPrompt): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.library.deleteHeader,
        message: T.library.deleteMessage(prompt.title),
        acceptLabel: T.library.deleteAccept,
      })
    ) {
      this.api.deletePrompt(prompt.id).subscribe(() => {
        this.prompts.update((prompts) => prompts.filter((candidate) => candidate.id !== prompt.id));
        this.snackbar.success(T.library.deleted);
      });
    }
  }
}
