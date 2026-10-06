import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MeetingsApi } from '../data-access/meetings-api';
import { MeetingRoom, RoomOwnerRef } from '../data-access/meetings.models';

/** An http(s) address; spaces around it are trimmed when it is saved. */
const ROOM_LINK_PATTERN = /^\s*https?:\/\/\S+\s*$/;

/**
 * The call of a student or a group, inside the dialog that edits them (a dialog never opens another
 * one, ADR-0026): the room of the portal by default (ADR-0030) or an external call link — paste it,
 * copy it, send it to the students, remove it. Every action is saved at once.
 */
@Component({
  selector: 'tb-room-panel',
  imports: [ReactiveFormsModule, Button, InputText, Message, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (owner(); as owner) {
      <section class="tb-form" aria-labelledby="room-panel-title">
        <h3 id="room-panel-title" class="tb-subtitle">Видеовстреча</h3>
        @if (room(); as room) {
          <div class="tb-room-link">
            <a [href]="room.joinUrl" target="_blank" rel="noopener">{{ room.joinUrl }}</a>
            <p-button
              icon="pi pi-copy"
              [text]="true"
              pTooltip="Копировать ссылку"
              [rounded]="true"
              severity="secondary"
              ariaLabel="Копировать ссылку"
              (onClick)="copy(room.joinUrl)"
            />
          </div>
          <div class="tb-actions">
            <p-button
              [label]="owner.type === 'GROUP' ? 'Отправить группе' : 'Отправить ученику'"
              icon="pi pi-send"
              class="tb-tonal"
              severity="success"
              [loading]="pending()"
              (onClick)="share(room.ownerId)"
            />
            <p-button
              label="Удалить ссылку"
              icon="pi pi-trash"
              severity="danger"
              [text]="true"
              [loading]="pending()"
              (onClick)="remove(room)"
            />
          </div>
          @if (callsOn()) {
            <small class="tb-hint"
              >В занятиях эта ссылка заменяет комнату портала. Удалите её, чтобы вести уроки в
              портале.</small
            >
          }
        } @else if (callsOn()) {
          <p class="tb-muted">
            Уроки идут в комнате портала (раздел «Звонки»): её ссылка попадает в напоминания,
            календарь и кнопку «Войти в урок». Можно задать ссылку на внешнюю видеосвязь — тогда
            занятия поведут по ней.
          </p>
          <div class="tb-actions">
            <p-button
              [label]="owner.type === 'GROUP' ? 'Отправить группе' : 'Отправить ученику'"
              icon="pi pi-send"
              class="tb-tonal"
              severity="success"
              [loading]="pending()"
              (onClick)="share(owner.id)"
            />
          </div>
        } @else {
          <p class="tb-muted">
            Постоянная ссылка: по ней
            {{ owner.type === 'GROUP' ? 'группа приходит' : 'ученик приходит' }}
            на все уроки. Ссылка попадёт в напоминания, календарь и кнопку «Войти в урок».
          </p>
        }
        <div class="tb-field">
          <label for="room-link">Ссылка на встречу</label>
          <div class="tb-copy-row">
            <input
              pInputText
              id="room-link"
              class="tb-grow"
              [formControl]="link"
              placeholder="https://telemost.yandex.ru/j/..."
              autocomplete="off"
              (keydown.enter)="$event.preventDefault(); save()"
            />
            <p-button
              [label]="room() === null ? 'Добавить ссылку' : 'Заменить ссылку'"
              severity="secondary"
              [text]="true"
              [disabled]="link.invalid || link.value.trim() === ''"
              [loading]="pending()"
              (onClick)="save()"
            />
          </div>
          @if (link.invalid) {
            <small class="tb-error">Ссылка должна начинаться с http:// или https://</small>
          }
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </section>
    }
  `,
  styles: `
    /* under the form of the dialog, apart from its fields */
    section {
      margin-top: var(--tb-space-6);
      padding-top: var(--tb-space-4);
      border-top: 1px solid var(--p-md-outline-variant);
    }

    .tb-subtitle {
      margin: 0;
    }

    .tb-room-link {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);

      a {
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class RoomPanel {
  private readonly api = inject(MeetingsApi);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(Snackbar);

  /** The student or the group whose room it is. */
  readonly owner = input<RoomOwnerRef | null>(null);

  protected readonly room = signal<MeetingRoom | null>(null);
  /** Built-in calls are set up: without a link the room of the portal is used (ADR-0030). */
  protected readonly callsOn = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly link = new FormControl('', {
    nonNullable: true,
    validators: [Validators.pattern(ROOM_LINK_PATTERN)],
  });

  constructor() {
    effect(() => {
      const owner = this.owner();
      this.room.set(null);
      this.error.set(null);
      this.link.reset('');
      if (owner !== null) {
        this.load(owner.id);
      }
    });
  }

  save(): void {
    const owner = this.owner();
    const value = this.link.value.trim();
    if (owner !== null && value !== '' && this.link.valid) {
      this.run(this.api.enterLink(owner, value), (room) => {
        this.room.set(room);
        this.link.reset('');
      });
    }
  }

  remove(room: MeetingRoom): void {
    this.run(this.api.removeRoom(room.ownerId), () => {
      this.room.set(null);
    });
  }

  share(ownerId: string): void {
    this.run(this.api.share(ownerId), (recipients) => {
      this.snackbar.success(`Ссылка отправлена, получателей: ${String(recipients)}`);
    });
  }

  copy(text: string): void {
    if (this.clipboard.copy(text)) {
      this.snackbar.success('Ссылка в буфере обмена');
    }
  }

  private load(ownerId: string): void {
    forkJoin({
      rooms: this.api.rooms(quietContext()),
      // the status only changes the words: without it the panel works as with calls off
      calls: this.api.calls(quietContext()).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ rooms, calls }) => {
        if (this.owner()?.id !== ownerId) {
          return;
        }
        this.room.set(rooms.find((room) => room.ownerId === ownerId) ?? null);
        this.callsOn.set(calls !== null && calls.status !== 'OFF');
      },
      error: () => {
        this.error.set('Не удалось загрузить видеовстречу. Откройте окно ещё раз');
      },
    });
  }

  private run<T>(request: Observable<T>, done: (value: T) => void): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        this.pending.set(false);
        done(value);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не получилось. Попробуйте позже'));
      },
    });
  }
}
