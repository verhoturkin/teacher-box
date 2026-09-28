import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { describeError } from '@core/http/error-messages';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { SettingsApi } from './data-access/settings-api';

/** The word the teacher types to confirm the reset. */
export const RESET_WORD = 'СБРОСИТЬ';

/** Teacher: deleting all data of the portal after a backup (ADR-0014). */
@Component({
  selector: 'tb-reset-card',
  imports: [ReactiveFormsModule, Button, Card, Dialog, HelpButton, InputText, Message, Password],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Полный сброс" id="reset">
      <tb-help-button topic="teacher/backups" label="Подробнее" />
      <p>
        Удаляет все данные портала: учеников и группы, занятия и расписание, оплаты, задания и
        файлы, уведомления и подключения мессенджеров, комнаты видеовстреч, доски, историю ИИ,
        подключения Google и Яндекса, название и адрес портала.
      </p>
      <p class="tb-muted">
        Остаются вход учителя и администратора (с прежними паролями) и резервные копии. Перед
        сбросом портал сам сделает копию — из неё всё можно вернуть.
      </p>
      <p-button
        label="Сбросить все данные…"
        icon="pi pi-trash"
        severity="danger"
        [outlined]="true"
        (onClick)="open()"
      />
    </p-card>
    <p-dialog
      header="Сбросить все данные?"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [draggable]="false"
    >
      <p>
        Все ученики, занятия, оплаты и задания будут удалены. Копия перед сбросом останется в
        «Резервных копиях».
      </p>
      <form class="tb-form" [formGroup]="form" (ngSubmit)="reset()">
        <div class="tb-field">
          <label for="reset-password">Ваш пароль</label>
          <p-password
            inputId="reset-password"
            formControlName="password"
            autocomplete="current-password"
            [feedback]="false"
            [toggleMask]="true"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="reset-word">Напишите «{{ word }}»</label>
          <input pInputText id="reset-word" formControlName="word" autocomplete="off" />
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        <div class="tb-actions">
          <p-button
            label="Отмена"
            severity="secondary"
            [text]="true"
            (onClick)="visible.set(false)"
          />
          <p-button
            type="submit"
            label="Сбросить"
            severity="danger"
            [disabled]="form.invalid || !confirmed()"
            [loading]="pending()"
          />
        </div>
      </form>
    </p-dialog>
  `,
})
export class ResetCard {
  private readonly api = inject(SettingsApi);
  private readonly portal = inject(Portal);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  protected readonly word = RESET_WORD;
  protected readonly visible = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    word: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  open(): void {
    this.form.reset();
    this.error.set(null);
    this.visible.set(true);
  }

  protected confirmed(): boolean {
    return this.form.controls.word.value.trim().toUpperCase() === RESET_WORD;
  }

  reset(): void {
    if (this.form.invalid || !this.confirmed() || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.reset(this.form.controls.password.value).subscribe({
      next: (result) => {
        this.pending.set(false);
        this.visible.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Данные удалены',
          detail: `Копия перед сбросом: ${result.backup}`,
        });
        for (const hint of result.hints) {
          this.messages.add({
            severity: 'warn',
            summary: 'Остался шаг',
            detail: hint,
            sticky: true,
          });
        }
        this.portal.setSetupCompleted(false);
        void this.portal.load().then(() => this.router.navigateByUrl('/teacher/setup'));
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось сбросить данные. Попробуйте позже'));
      },
    });
  }
}
