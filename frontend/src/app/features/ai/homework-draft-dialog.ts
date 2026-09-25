import { ChangeDetectionStrategy, Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { AiApi } from './data-access/ai-api';
import { HomeworkDraft } from './data-access/ai.models';

/** Asks the AI assistant for a draft of homework; the result goes to the assignment editor. */
@Component({
  selector: 'tb-homework-draft-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, InputNumber, InputText, Message, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog header="Черновик задания с ИИ" [(visible)]="visible" [modal]="true" [style]="{ width: '34rem' }" [draggable]="false">
      <form class="tb-form" [formGroup]="form" (ngSubmit)="generate()">
        <div class="tb-field">
          <label for="ai-topic">Тема</label>
          <input pInputText id="ai-topic" formControlName="topic" autocomplete="off" placeholder="например, сложение дробей" />
        </div>
        <div class="tb-field">
          <label for="ai-level">Уровень ученика</label>
          <input pInputText id="ai-level" formControlName="level" autocomplete="off" placeholder="например, 6 класс, базовый" />
        </div>
        <div class="tb-field">
          <label for="ai-count">Количество задач</label>
          <p-inputnumber inputId="ai-count" formControlName="taskCount" [min]="1" [max]="20" [showButtons]="true" />
        </div>
        <div class="tb-field">
          <label for="ai-wishes">Пожелания</label>
          <textarea pTextarea id="ai-wishes" formControlName="wishes" rows="3" placeholder="формат, типы задач, на что обратить внимание"></textarea>
        </div>
        <small class="tb-hint">Черновик заменит название и текст задания — вы сможете их отредактировать.</small>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Сгенерировать" icon="pi pi-sparkles" [loading]="pending()" [disabled]="form.invalid" (onClick)="generate()" />
      </ng-template>
    </p-dialog>
  `,
})
export class HomeworkDraftDialog {
  private readonly api = inject(AiApi);

  readonly visible = model(false);
  /** Prefills the topic, e.g. with the title already typed by the teacher. */
  readonly topic = input('');
  readonly generated = output<HomeworkDraft>();

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    topic: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300)] }),
    level: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    taskCount: new FormControl<number | null>(5, [Validators.required, Validators.min(1), Validators.max(20)]),
    wishes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.error.set(null);
        this.form.controls.topic.setValue(this.topic());
      }
    });
  }

  generate(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || this.pending() || value.taskCount === null) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .homeworkDraft({
        topic: value.topic.trim(),
        level: value.level.trim() === '' ? null : value.level.trim(),
        taskCount: value.taskCount,
        wishes: value.wishes.trim() === '' ? null : value.wishes.trim(),
      })
      .subscribe({
        next: (draft) => {
          this.pending.set(false);
          this.visible.set(false);
          this.generated.emit(draft);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, 'Не удалось получить черновик. Попробуйте ещё раз'));
        },
      });
  }
}
