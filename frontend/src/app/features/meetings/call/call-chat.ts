import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { CHAT_LIMIT } from './call-engine';
import { CallSession } from './call-session';
import { T } from '../i18n/texts';

/**
 * The chat of the call (409.1): a side sheet of the call window with the messages of this call
 * only, a field and «Отправить». Nothing is stored: the chat ends with the call.
 */
@Component({
  selector: 'tb-call-chat',
  imports: [Button, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Global class names, loaded with the call (design-system «Where it lives»)
  encapsulation: ViewEncapsulation.None,
  styleUrl: './call-chat.scss',
  host: {
    class: 'tb-call-chat',
    role: 'complementary',
    '[attr.aria-labelledby]': '"tb-call-chat-title"',
  },
  template: `
    <header class="tb-call-chat__header">
      <h3 id="tb-call-chat-title" class="tb-call-chat__title">{{ t.title }}</h3>
      <p-button
        icon="tb-i tb-i-close"
        [rounded]="true"
        [text]="true"
        severity="secondary"
        [ariaLabel]="t.close"
        (onClick)="session.toggleChat()"
      />
    </header>
    <!-- column-reverse keeps the newest message in view without code -->
    <div class="tb-call-chat__scroll">
      <div class="tb-call-chat__log" role="log" aria-labelledby="tb-call-chat-title">
        @for (line of session.messages(); track line.id) {
          <div class="tb-call-chat__message" [class.tb-call-chat__message--mine]="line.mine">
            <span class="tb-call-chat__from">{{ line.mine ? t.you : line.from }}</span>
            <p class="tb-call-chat__text">{{ line.text }}</p>
          </div>
        } @empty {
          <p class="tb-call-chat__empty">{{ t.empty }}</p>
        }
      </div>
    </div>
    <form class="tb-call-chat__form" (submit)="send($event)">
      <input
        #field
        pInputText
        class="tb-call-chat__field"
        [attr.aria-label]="t.field"
        [placeholder]="t.field"
        [maxLength]="limit"
        autocomplete="off"
      />
      <p-button
        type="submit"
        icon="tb-i tb-i-send"
        [rounded]="true"
        [ariaLabel]="t.send"
        [loading]="sending()"
      />
    </form>
  `,
})
export class CallChat implements AfterViewInit {
  protected readonly t = T.chat;
  protected readonly session = inject(CallSession);
  protected readonly limit = CHAT_LIMIT;
  protected readonly sending = signal(false);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  ngAfterViewInit(): void {
    this.field().nativeElement.focus();
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    const field = this.field().nativeElement;
    if (this.sending()) {
      return;
    }
    this.sending.set(true);
    const sent = await this.session.sendMessage(field.value);
    this.sending.set(false);
    if (sent) {
      field.value = '';
    }
    field.focus();
  }
}
