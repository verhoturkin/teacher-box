import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Observable, forkJoin, of } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH, portalAddressValidator } from '@core/portal/portal-address';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { BillingApi } from '@features/billing/parts';
import { HelpButton, helpUrl } from '@features/help/parts';
import { ChangePasswordForm, IdentityApi } from '@features/identity/parts';
import { ScheduleApi } from '@features/schedule/parts';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { SettingsApi } from '../data-access/settings-api';
import { PageHeader } from '@shared/ui/page-header';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';

type StepId = 'password' | 'about' | 'address' | 'price' | 'next';

interface Step {
  readonly id: StepId;
  readonly title: string;
}

const STEPS: readonly Step[] = [
  { id: 'password', title: 'Пароль' },
  { id: 'about', title: 'Знакомство' },
  { id: 'address', title: 'Адрес' },
  { id: 'price', title: 'Занятия' },
  { id: 'next', title: 'Готово' },
];

/**
 * The teacher's first setup (ADR-0014): the own password instead of the generated one, the name,
 * the name and the address of the portal, the lesson price, and what to connect later.
 */
@Component({
  selector: 'tb-setup-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    Card,
    ChangePasswordForm,
    HelpButton,
    InputNumber,
    InputText,
    Message,
    PortalAddressField,
    PageHeader,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-setup">
      <tb-page-header title="Первоначальная настройка">
        <tb-help-button help topic="teacher/setup" />
      </tb-page-header>
      <p class="tb-muted">
        Несколько коротких шагов — и портал готов к работе. Всё это можно поменять потом в
        «Настройках».
      </p>
      <ol class="tb-setup-steps" aria-label="Шаги настройки">
        @for (step of steps(); track step.id; let index = $index) {
          <li
            [class.tb-setup-steps__current]="step.id === current()"
            [class.tb-setup-steps__done]="index < currentIndex()"
            [attr.aria-current]="step.id === current() ? 'step' : null"
          >
            <span class="tb-setup-steps__number">
              @if (index < currentIndex()) {
                <i class="pi pi-check" aria-hidden="true"></i>
              } @else {
                {{ index + 1 }}
              }
            </span>
            {{ step.title }}
          </li>
        }
      </ol>
      <p-card>
        @switch (current()) {
          @case ('password') {
            <h2 class="tb-setup-title">Придумайте свой пароль</h2>
            <p>
              Пароль для первого входа портал создал сам и записал в журнал сервера. Замените его на
              свой — после этого старый пароль перестанет работать.
            </p>
            <tb-change-password-form
              currentLabel="Пароль, с которым вы вошли"
              submitLabel="Сохранить и продолжить"
              (changed)="next()"
            />
          }
          @case ('about') {
            <h2 class="tb-setup-title">Знакомство</h2>
            <form tbFieldErrors class="tb-form" [formGroup]="about" (ngSubmit)="saveAbout()">
              <div class="tb-field">
                <label for="setup-teacher-name">Ваше имя</label>
                <input
                  pInputText
                  id="setup-teacher-name"
                  formControlName="teacherName"
                  maxlength="100"
                  autocomplete="name"
                />
                <small class="tb-hint">Так вас видят ученики в портале и в сообщениях бота.</small>
              </div>
              <div class="tb-field">
                <label for="setup-portal-name">Название портала</label>
                <input
                  pInputText
                  id="setup-portal-name"
                  formControlName="portalName"
                  [placeholder]="defaultName"
                  [maxlength]="maxNameLength"
                  autocomplete="off"
                />
                <small class="tb-hint">
                  Например, «Английский с Марией Ивановной». Видно в шапке, на странице входа и в
                  календаре.
                </small>
              </div>
              <div class="tb-actions">
                <p-button type="submit" label="Далее" [loading]="pending()" />
              </div>
            </form>
          }
          @case ('address') {
            <h2 class="tb-setup-title">Адрес портала</h2>
            <form tbFieldErrors class="tb-form" [formGroup]="address" (ngSubmit)="saveAddress()">
              <tb-portal-address-field
                inputId="setup-address"
                [control]="address.controls.address"
                [fromEnvironment]="settings()?.addressFromEnvironment ?? false"
              />
              @if (timeZone(); as zone) {
                <p class="tb-muted">Часовой пояс портала: {{ zone }}.</p>
                @if (zone !== browserZone) {
                  <p-message severity="warn" styleClass="tb-form-message">
                    На этом компьютере другой часовой пояс ({{ browserZone }}). Время занятий портал
                    считает по часовому поясу портала; поменять его можно на сервере
                    (TEACHERBOX_TIMEZONE).
                  </p-message>
                }
              }
              <div class="tb-actions">
                <p-button label="Назад" severity="secondary" (onClick)="back()" />
                <p-button type="submit" label="Далее" [loading]="pending()" />
              </div>
            </form>
          }
          @case ('price') {
            <h2 class="tb-setup-title">Стоимость занятия</h2>
            <p>
              Проведённые занятия списываются с баланса ученика по этой цене. Она достаётся новым
              ученикам и группам; у каждого ученика цену можно поменять отдельно.
            </p>
            <form
              tbFieldErrors
              class="tb-form tb-form--narrow"
              [formGroup]="price"
              (ngSubmit)="savePrice()"
            >
              <div class="tb-field">
                <label for="setup-price">Цена одного занятия</label>
                <p-inputnumber
                  inputId="setup-price"
                  formControlName="price"
                  mode="currency"
                  [currency]="currency()"
                  locale="ru-RU"
                  [min]="0"
                  [fluid]="true"
                />
              </div>
              <div class="tb-actions">
                <p-button label="Назад" severity="secondary" (onClick)="back()" />
                <p-button type="submit" label="Далее" [loading]="pending()" />
              </div>
            </form>
          }
          @case ('next') {
            <h2 class="tb-setup-title">Готово!</h2>
            <p>Портал настроен. Остальное можно подключить, когда понадобится:</p>
            <ul class="tb-setup-later">
              <li>
                <a
                  routerLink="/teacher/notifications"
                  [queryParams]="{ open: 'messengers' }"
                  fragment="notifications-messengers"
                >
                  Мессенджеры
                </a>
                — уведомления и действия через бота в Telegram, ВКонтакте или MAX.
              </li>
              <li>
                <a routerLink="/teacher/settings" fragment="meetings">Видеовстречи</a>
                — постоянные ссылки на уроки в Яндекс Телемосте.
              </li>
              <li>
                <a routerLink="/teacher/settings" fragment="google">Google Календарь</a> — занятия в
                вашем календаре.
              </li>
              <li>
                <a [routerLink]="aiHelp">ИИ-помощник</a> — черновики заданий и проверки работ
                (включается на сервере).
              </li>
            </ul>
            <p>Начните с главного: добавьте ученика и запланируйте первое занятие.</p>
            <div class="tb-actions">
              <p-button label="Назад" severity="secondary" (onClick)="back()" />
              <p-button
                label="Перейти на главную"
                icon="pi pi-home"
                [loading]="pending()"
                (onClick)="finish()"
              />
            </div>
          }
        }
      </p-card>
      @if (current() !== 'password' && current() !== 'next') {
        <p-button
          label="Пропустить настройку"
          severity="secondary"
          [text]="true"
          [loading]="pending()"
          (onClick)="finish()"
        />
      }
    </div>
  `,
  styles: `
    .tb-setup {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      max-width: 44rem;
    }

    .tb-setup-steps {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3) var(--tb-space-6);
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);

      li {
        display: flex;
        align-items: center;
        gap: var(--tb-space-2);
      }

      .tb-setup-steps__number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: var(--tb-shape-full);
        background: var(--p-md-surface-container-highest);
        color: var(--p-md-on-surface-variant);
        font: var(--tb-type-label-m);

        .pi {
          font-size: 0.75rem;
        }
      }

      .tb-setup-steps__current {
        color: var(--p-md-on-surface);

        .tb-setup-steps__number {
          background: var(--p-md-primary);
          color: var(--p-md-on-primary);
        }
      }

      .tb-setup-steps__done .tb-setup-steps__number {
        background: var(--p-md-primary-container);
        color: var(--p-md-on-primary-container);
      }
    }

    .tb-setup-title {
      margin-top: 0;
      font: var(--tb-type-title-l);
    }

    .tb-setup-later {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding-left: var(--tb-space-5);
    }
  `,
})
export class SetupPage implements OnInit {
  private readonly settingsApi = inject(SettingsApi);
  private readonly identity = inject(IdentityApi);
  private readonly billing = inject(BillingApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly auth = inject(AuthService);
  private readonly portal = inject(Portal);
  private readonly router = inject(Router);

  protected readonly defaultName = DEFAULT_PORTAL_NAME;
  protected readonly maxNameLength = MAX_PORTAL_NAME_LENGTH;
  protected readonly browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  protected readonly aiHelp = helpUrl('teacher/ai');

  /** The password step is there only when the password was generated (decided on opening). */
  protected readonly steps = signal<readonly Step[]>(
    STEPS.filter((step) => step.id !== 'password' || this.passwordRequired()),
  );
  protected readonly current = signal<StepId>(this.steps()[0]?.id ?? 'about');
  protected readonly currentIndex = computed(() =>
    this.steps().findIndex((step) => step.id === this.current()),
  );
  protected readonly settings = signal<PortalSettings | null>(null);
  protected readonly currency = signal('RUB');
  protected readonly timeZone = signal<string | null>(null);
  protected readonly pending = signal(false);

  readonly about = new FormGroup({
    teacherName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
    }),
    portalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PORTAL_NAME_LENGTH)],
    }),
  });
  readonly address = new FormGroup({
    address: new FormControl('', { nonNullable: true, validators: [portalAddressValidator] }),
  });
  readonly price = new FormGroup({
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  ngOnInit(): void {
    this.about.controls.teacherName.setValue(this.auth.user()?.displayName ?? '');
    this.settingsApi.portal().subscribe((settings) => {
      this.settings.set(settings);
      this.about.controls.portalName.setValue(settings.name);
      this.address.controls.address.setValue(settings.address ?? this.portal.openedAt());
    });
    this.billing.overview().subscribe((overview) => {
      this.currency.set(overview.currency);
      this.price.controls.price.setValue(
        toMajorUnits(overview.defaultLessonPrice, overview.currency),
      );
    });
    this.schedule.settings().subscribe((settings) => {
      this.timeZone.set(settings.timeZone);
    });
  }

  next(): void {
    const following = this.steps()[this.currentIndex() + 1];
    if (following !== undefined) {
      this.current.set(following.id);
    }
  }

  back(): void {
    const previous = this.steps()[this.currentIndex() - 1];
    if (previous !== undefined && previous.id !== 'password') {
      this.current.set(previous.id);
    }
  }

  saveAbout(): void {
    if (!revealErrors(this.about) || this.pending()) {
      return;
    }
    const { teacherName, portalName } = this.about.getRawValue();
    const name = teacherName.trim();
    const renamed =
      name === this.auth.user()?.displayName ? of(null) : this.identity.renameTeacher(name);
    this.save(
      forkJoin([renamed, this.settingsApi.changePortal(portalName, this.savedAddress())]),
      ([account, settings]) => {
        if (account !== null) {
          this.auth.renamed(account.displayName);
        }
        this.showSettings(settings);
      },
    );
  }

  saveAddress(): void {
    if (!revealErrors(this.address) || this.pending()) {
      return;
    }
    const name = this.settings()?.name ?? '';
    this.save(
      this.settingsApi.changePortal(name, this.address.controls.address.value),
      (settings) => {
        this.showSettings(settings);
      },
    );
  }

  savePrice(): void {
    const price = this.price.controls.price.value;
    if (!revealErrors(this.price) || price === null || this.pending()) {
      return;
    }
    this.save(this.billing.changeDefaultPrice(toMinorUnits(price, this.currency())), () => {
      // Nothing to show: the price is in the form.
    });
  }

  /** Finishing and skipping are the same: the wizard does not open any more. */
  finish(): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.settingsApi.completeSetup().subscribe({
      next: () => {
        this.pending.set(false);
        this.portal.setSetupCompleted(true);
        void this.router.navigateByUrl('/teacher');
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  protected passwordRequired(): boolean {
    return this.auth.user()?.passwordChangeRequired === true;
  }

  /** Saves a step and moves on. */
  private save<T>(request: Observable<T>, done: (result: T) => void): void {
    this.pending.set(true);
    request.subscribe({
      next: (result) => {
        this.pending.set(false);
        done(result);
        this.next();
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  private showSettings(settings: PortalSettings): void {
    this.settings.set(settings);
    this.portal.set(settings);
  }

  /** The address as it is saved, so that saving the name keeps it. */
  private savedAddress(): string {
    return this.settings()?.address ?? '';
  }
}
