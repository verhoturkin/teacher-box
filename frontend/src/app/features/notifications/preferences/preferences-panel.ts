import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { describeError } from '@core/http/error-messages';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationPreferences, NotificationTopic } from '../data-access/notifications.models';
import { MUTABLE_TOPICS } from '../notification-labels';

/** Every half hour of the day: `00:00`, `00:30` … `23:30`. */
export const QUIET_TIMES: readonly string[] = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  return `${hours}:${index % 2 === 0 ? '00' : '30'}`;
});

const DEFAULT_QUIET_FROM = '22:00';
const DEFAULT_QUIET_TO = '08:00';

/** `HH:mm` of a backend time (`HH:mm` or `HH:mm:ss`). */
function shortTime(time: string | null, fallback: string): string {
  return time === null ? fallback : time.slice(0, 5);
}

/** What the user gets in messengers: topics and quiet hours. The personal area always shows everything. */
@Component({
  selector: 'tb-preferences-panel',
  imports: [ReactiveFormsModule, Button, Card, Checkbox, Message, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Что присылать в мессенджеры">
      <p class="tb-muted">В личном кабинете видны все уведомления. Здесь можно выбрать, какие из них дублировать в мессенджеры.</p>
      @if (loaded()) {
        <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <fieldset class="tb-topics">
            <legend class="tb-sr-only">Темы уведомлений</legend>
            @for (topic of topics(); track topic.topic; let index = $index) {
              <div class="tb-topic">
                <p-checkbox [formControl]="topicControl(index)" [binary]="true" [inputId]="'topic-' + topic.topic" />
                <label [for]="'topic-' + topic.topic">
                  <strong>{{ topic.label }}</strong>
                  <small class="tb-muted">{{ topic.hint }}</small>
                </label>
              </div>
            }
            <div class="tb-topic">
              <p-checkbox [formControl]="alwaysOn" [binary]="true" inputId="topic-MESSAGES" />
              <label for="topic-MESSAGES">
                <strong>{{ teacher() ? 'Сообщения' : 'Сообщения учителя' }}</strong>
                <small class="tb-muted">приходят всегда</small>
              </label>
            </div>
          </fieldset>

          <div class="tb-quiet">
            <label class="tb-switch" for="quiet-enabled">
              <p-toggleswitch formControlName="quiet" inputId="quiet-enabled" />
              <span>Тихие часы — не присылать ночью</span>
            </label>
            @if (form.controls.quiet.value) {
              <div class="tb-quiet__times">
                <label for="quiet-from">с</label>
                <p-select inputId="quiet-from" formControlName="quietFrom" [options]="times" appendTo="body" />
                <label for="quiet-to">до</label>
                <p-select inputId="quiet-to" formControlName="quietTo" [options]="times" appendTo="body" />
              </div>
              <small class="tb-hint">Уведомления за это время придут в мессенджер, когда тихие часы закончатся.</small>
            }
          </div>

          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <div class="tb-actions">
            <p-button type="submit" label="Сохранить" icon="pi pi-check" [loading]="pending()" [disabled]="form.pristine" />
          </div>
        </form>
      }
    </p-card>
  `,
  styles: `
    .tb-topics {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .tb-topic {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;

      label {
        display: flex;
        flex-direction: column;
      }
    }

    .tb-quiet {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .tb-quiet__times {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class PreferencesPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly messages = inject(MessageService);

  /** The teacher also gets notifications about students and the calendar. */
  readonly teacher = input(false);

  protected readonly topics = computed(() => MUTABLE_TOPICS.filter((topic) => this.teacher() || !topic.teacherOnly));
  protected readonly times = [...QUIET_TIMES];
  protected readonly loaded = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Messages from the teacher cannot be muted. */
  protected readonly alwaysOn = new FormControl({ value: true, disabled: true }, { nonNullable: true });

  readonly form = new FormGroup({
    topics: new FormArray<FormControl<boolean>>([]),
    quiet: new FormControl(false, { nonNullable: true }),
    quietFrom: new FormControl(DEFAULT_QUIET_FROM, { nonNullable: true }),
    quietTo: new FormControl(DEFAULT_QUIET_TO, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.api.preferences().subscribe((preferences) => {
      this.fill(preferences);
      this.loaded.set(true);
    });
  }

  protected topicControl(index: number): FormControl<boolean> {
    return this.form.controls.topics.at(index);
  }

  save(): void {
    if (this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const muted: NotificationTopic[] = this.topics()
      .filter((_, index) => value.topics[index] === false)
      .map((topic) => topic.topic);
    this.pending.set(true);
    this.error.set(null);
    this.api
      .savePreferences({
        mutedTopics: muted,
        quietFrom: value.quiet ? value.quietFrom : null,
        quietTo: value.quiet ? value.quietTo : null,
      })
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.fill(saved);
          this.messages.add({ severity: 'success', summary: 'Сохранено', detail: 'Настройки уведомлений сохранены' });
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, 'Не удалось сохранить настройки'));
        },
      });
  }

  private fill(preferences: NotificationPreferences): void {
    const muted = new Set(preferences.mutedTopics);
    const topics = this.form.controls.topics;
    topics.clear();
    for (const topic of this.topics()) {
      topics.push(new FormControl(!muted.has(topic.topic), { nonNullable: true }));
    }
    this.form.patchValue({
      quiet: preferences.quietFrom !== null,
      quietFrom: shortTime(preferences.quietFrom, DEFAULT_QUIET_FROM),
      quietTo: shortTime(preferences.quietTo, DEFAULT_QUIET_TO),
    });
    this.form.markAsPristine();
  }
}
