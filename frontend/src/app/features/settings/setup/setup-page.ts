import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, concat, forkJoin, map, of, tap, toArray } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { AuthService } from '@core/auth/auth.service';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectWindowSize } from '@core/layout/mobile';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH, portalAddressValidator } from '@core/portal/portal-address';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { PortalLogo } from '@core/portal/portal-logo';
import { AiApi } from '@features/ai/parts';
import { BillingApi, PriceField } from '@features/billing/parts';
import { HelpButton } from '@features/help/parts';
import { HomeworkApi } from '@features/homework/parts';
import {
  Account,
  ChangePasswordForm,
  IdentityApi,
  ProfilePhoto,
  TEACHER_NAME_VALIDATORS,
  TeacherNameField,
} from '@features/identity/parts';
import { LessonRules, ScheduleApi } from '@features/schedule/parts';
import { formatMoney, toMajorUnits, toMinorUnits } from '@shared/money/money';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { ProgressLabel } from '@shared/ui/progress-label.directive';
import { locale } from '@core/i18n/language';
import { SettingsApi } from '../data-access/settings-api';
import { CurrencyField } from '../fields/currency-field';
import {
  DueSoonField,
  DurationField,
  HorizonField,
  LateCancellationField,
} from '../fields/lesson-rule-fields';
import { PortalNameField } from '../fields/portal-name-field';
import { RemindersField } from '../fields/reminders-field';
import { TimeZoneField } from '../fields/time-zone-field';
import { T } from '../i18n/texts';
import { deviceZone, spanLabel, zoneLabel } from '../lesson-options';
import { HOUR } from '../lesson-rules';
import { aiState, messengersState } from '../settings-categories';
import { dueSoonExample, horizonExample, lateExample, remindersExample } from './setup-examples';

export type StepId = 'password' | 'portal' | 'time' | 'rules' | 'done';

interface Step {
  readonly id: StepId;
  readonly title: string;
}

const t = T.setup;

const STEPS: readonly Step[] = [
  { id: 'password', title: t.stepPassword },
  { id: 'portal', title: t.stepPortal },
  { id: 'time', title: t.stepTime },
  { id: 'rules', title: t.stepRules },
  { id: 'done', title: t.stepDone },
];

/** What the teacher has set up so far, as the server keeps it (the start of «Пропустить»). */
interface Saved {
  readonly account: Account;
  readonly portal: PortalSettings;
  readonly zone: string;
  readonly currency: string;
  readonly locked: boolean;
  /** Minor units. */
  readonly price: number;
  readonly rules: LessonRules;
  readonly dueSoon: number;
}

/** A card of «Готово»: where it leads and its state once known. */
interface NextCard {
  readonly id: 'student' | 'messenger' | 'ai' | 'google';
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly link: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly state: string | null;
  readonly done: boolean;
}

/** A row of «Что вы настроили» and the step that changes it. */
interface SummaryRow {
  readonly label: string;
  readonly value: string;
  readonly step: StepId;
}

/** A sample lesson at 18:00 next Thursday on this device (sketch OnbTime). */
function sampleLesson(now = new Date()): Date {
  const lesson = new Date(now);
  lesson.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7));
  lesson.setHours(18, 0, 0, 0);
  return lesson;
}

/**
 * The teacher's first setup (ADR-0014, sketches OnbFlow…OnbPhone): full-screen, outside the shell. Steps:
 * the own password (only while the generated one is in force), «Вы и портал», «Время и оплата», «Правила»
 * and «Готово». Every field is prefilled with a working default; «Далее» saves the step, «Пропустить» keeps
 * what the server has. The fields are the components of Settings (one component per setting). Expanded
 * widths show three columns — steps · form · example; compact and medium a top bar with «Шаг N из M», a
 * linear progress and «Далее» pinned at the bottom.
 */
@Component({
  selector: 'tb-setup-page',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    Button,
    Card,
    ProgressBar,
    ChangePasswordForm,
    CurrencyField,
    DueSoonField,
    DurationField,
    FieldErrors,
    HelpButton,
    HorizonField,
    LateCancellationField,
    LoadStateView,
    PortalAddressField,
    PortalLogo,
    PortalNameField,
    PriceField,
    ProfilePhoto,
    ProgressLabel,
    RemindersField,
    TeacherNameField,
    TimeZoneField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-setup', '[class.tb-setup--compact]': 'compact()' },
  template: `
    <header class="tb-setup__bar">
      @if (compact()) {
        @if (canGoBack()) {
          <p-button
            icon="tb-i tb-i-arrow_back"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="t.back"
            (onClick)="back()"
          />
        } @else {
          <tb-portal-logo size="2.5rem" class="tb-setup__logo" />
        }
        <b class="tb-setup__title">{{ stepOf() }}</b>
        @if (skippable()) {
          <p-button [label]="t.skip" [text]="true" [disabled]="pending()" (onClick)="skip()" />
        } @else {
          <p-button
            icon="tb-i tb-i-logout"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="t.signOut"
            (onClick)="signOut()"
          />
        }
      } @else {
        <tb-portal-logo size="2.5rem" class="tb-setup__logo" />
        <b class="tb-setup__title">{{ t.title }}</b>
        <span class="tb-muted">{{ stepOf() }}</span>
        <tb-help-button help topic="teacher/setup" />
        <p-button [label]="t.signOut" icon="tb-i tb-i-logout" [text]="true" (onClick)="signOut()" />
      }
    </header>
    @if (compact()) {
      <p-progressbar
        [value]="percent()"
        [showValue]="false"
        styleClass="tb-setup__progress"
        [tbProgressLabel]="stepOf()"
      />
    }

    <main class="tb-setup__pane">
      @if (!compact()) {
        <ol class="tb-setup__steps" [attr.aria-label]="t.steps">
          @for (step of steps(); track step.id; let index = $index) {
            <li
              [class.tb-setup__step--current]="step.id === current()"
              [class.tb-setup__step--done]="index < currentIndex()"
              [attr.aria-current]="step.id === current() ? 'step' : null"
            >
              <span class="tb-setup__number" aria-hidden="true">
                @if (index < currentIndex()) {
                  <i class="tb-i tb-i-check"></i>
                } @else {
                  {{ index + 1 }}
                }
              </span>
              {{ step.title }}
            </li>
          }
        </ol>
      }

      <section class="tb-setup__main" aria-labelledby="setup-step-title">
        <h1 id="setup-step-title" class="tb-setup__heading">{{ heading() }}</h1>
        <tb-load-state [state]="state" [what]="t.whatWait" (retry)="load()">
          @switch (current()) {
            @case ('password') {
              <p class="tb-setup__lead">{{ t.passwordText }}</p>
              <p-card styleClass="tb-section-card tb-section-card--flow">
                <tb-change-password-form
                  [currentLabel]="t.currentPassword"
                  [submitLabel]="t.next"
                  (changed)="passwordChanged()"
                />
              </p-card>
            }
            @case ('portal') {
              <p class="tb-setup__lead">{{ t.portalLead }}</p>
              <form
                tbFieldErrors
                id="setup-portal"
                class="tb-stack"
                [formGroup]="portalForm"
                (ngSubmit)="next()"
              >
                <button type="submit" class="tb-sr-only" tabindex="-1" aria-hidden="true"></button>
                <p-card [header]="t.aboutYou" styleClass="tb-section-card tb-section-card--flow">
                  @if (account(); as account) {
                    <tb-profile-photo
                      [account]="account"
                      [hint]="t.photoLater"
                      (changed)="photoChanged($event)"
                    />
                  }
                  <tb-teacher-name-field
                    inputId="setup-teacher-name"
                    [label]="t.teacherName"
                    [control]="portalForm.controls.teacherName"
                  />
                </p-card>
                <p-card [header]="t.portalCard" styleClass="tb-section-card tb-section-card--flow">
                  <tb-portal-name-field
                    inputId="setup-portal-name"
                    [control]="portalForm.controls.portalName"
                  />
                  <tb-portal-address-field
                    inputId="setup-address"
                    [checkable]="true"
                    [control]="portalForm.controls.address"
                  />
                </p-card>
              </form>
            }
            @case ('time') {
              <p class="tb-setup__lead">{{ t.timeLead }}</p>
              <form id="setup-time" class="tb-stack" [formGroup]="timeForm" (ngSubmit)="next()">
                <button type="submit" class="tb-sr-only" tabindex="-1" aria-hidden="true"></button>
                <p-card [header]="t.timeCard" styleClass="tb-section-card tb-section-card--flow">
                  <tb-time-zone-field inputId="setup-zone" [control]="timeForm.controls.zone" />
                  <tb-duration-field
                    inputId="setup-duration"
                    [hint]="true"
                    [control]="timeForm.controls.duration"
                  />
                </p-card>
                <p-card [header]="t.paymentCard" styleClass="tb-section-card tb-section-card--flow">
                  <div class="tb-setup__two">
                    <tb-currency-field
                      inputId="setup-currency"
                      [short]="true"
                      [locked]="saved()?.locked ?? false"
                      [control]="timeForm.controls.currency"
                    />
                    <tb-price-field
                      inputId="setup-price"
                      [short]="true"
                      [currency]="currency() ?? 'RUB'"
                      [control]="timeForm.controls.price"
                    />
                  </div>
                  <small class="tb-hint tb-setup__shared-hint"
                    ><i class="tb-i tb-i-info" aria-hidden="true"></i>{{ t.paymentHint }}</small
                  >
                </p-card>
              </form>
            }
            @case ('rules') {
              <p class="tb-setup__lead">{{ t.rulesLead }}</p>
              <form id="setup-rules" class="tb-stack" [formGroup]="rulesForm" (ngSubmit)="next()">
                <button type="submit" class="tb-sr-only" tabindex="-1" aria-hidden="true"></button>
                <p-card [header]="t.cancelCard" styleClass="tb-section-card tb-section-card--flow">
                  <tb-late-cancellation-field
                    inputId="setup-late"
                    [control]="rulesForm.controls.late"
                  />
                  <tb-reminders-field labelId="setup-reminders" [(reminders)]="reminders" />
                </p-card>
                <p-card
                  [header]="t.homeworkCard"
                  styleClass="tb-section-card tb-section-card--flow"
                >
                  <div class="tb-stack">
                    <tb-due-soon-field
                      inputId="setup-due-soon"
                      [control]="rulesForm.controls.dueSoon"
                    />
                    <tb-horizon-field
                      inputId="setup-horizon"
                      [control]="rulesForm.controls.horizon"
                    />
                  </div>
                </p-card>
              </form>
            }
            @case ('done') {
              <p class="tb-setup__lead">{{ t.doneLead }}</p>
              <ul class="tb-setup__next" [attr.aria-label]="t.nextSteps">
                @for (card of nextCards(); track card.id; let first = $first) {
                  <li>
                    <button
                      type="button"
                      class="tb-setup__card"
                      [class.tb-setup__card--hero]="first"
                      [disabled]="pending()"
                      (click)="finish(card.link, card.query)"
                    >
                      <span class="tb-setup__card-icon" aria-hidden="true"
                        ><i class="tb-i" [class]="card.icon"></i
                      ></span>
                      <b>{{ card.title }}</b>
                      <span class="tb-setup__card-text">{{ card.text }}</span>
                      @if (card.state !== null) {
                        <span class="tb-setup__card-state" [class.tb-positive]="card.done">
                          @if (card.done) {
                            <i class="tb-i tb-i-check_circle" aria-hidden="true"></i>
                          }
                          {{ card.state }}
                        </span>
                      }
                    </button>
                  </li>
                }
              </ul>
            }
          }
          @if (compact() && current() !== 'password') {
            <ng-container [ngTemplateOutlet]="asideTemplate" />
          }
          @if (current() !== 'password') {
            <div class="tb-setup__actions" [class.tb-bottom-actions]="compact()">
              @if (!compact() && canGoBack()) {
                <p-button
                  [label]="t.back"
                  icon="tb-i tb-i-arrow_back"
                  [text]="true"
                  (onClick)="back()"
                />
              }
              @if (!compact()) {
                <span class="tb-grow"></span>
              }
              @if (!compact() && skippable()) {
                <p-button
                  [label]="current() === 'portal' ? t.skipFirst : t.skip"
                  [text]="true"
                  [disabled]="pending()"
                  (onClick)="skip()"
                />
              }
              @if (current() === 'done') {
                <p-button
                  [label]="t.goToPortal"
                  icon="tb-i tb-i-arrow_forward"
                  iconPos="right"
                  [loading]="pending()"
                  (onClick)="finish('/teacher')"
                />
              } @else {
                <p-button
                  [label]="t.next"
                  [icon]="compact() ? '' : 'tb-i tb-i-arrow_forward'"
                  iconPos="right"
                  [loading]="pending()"
                  (onClick)="next()"
                />
              }
            </div>
          }
        </tb-load-state>
      </section>

      @if (state.ready() && !compact()) {
        <ng-container [ngTemplateOutlet]="asideTemplate" />
      }
    </main>

    <ng-template #asideTemplate>
      <aside class="tb-setup__aside" [attr.aria-label]="asideTitle()">
        @switch (current()) {
          @case ('portal') {
            <span class="tb-setup__cap">{{ t.studentSees }}</span>
            <div class="tb-setup__preview tb-setup__preview--center">
              <div class="tb-setup__login">
                <tb-portal-logo size="2.5rem" />
                <b class="tb-setup__login-name">{{ portalName() }}</b>
                <span class="tb-muted">{{ t.studentSignIn }}</span>
                <span class="tb-setup__login-field"></span>
                <span class="tb-setup__login-field"></span>
                <span class="tb-setup__login-button">{{ t.signIn }}</span>
              </div>
              <p class="tb-setup__bubble">
                {{ t.invite(teacherName(), portalName()) }}
                <span class="tb-setup__link">{{ inviteLink() }}</span>
              </p>
            </div>
          }
          @case ('time') {
            <span class="tb-setup__cap">{{ t.inSchedule }}</span>
            <div class="tb-setup__preview">
              <div class="tb-setup__lesson">
                <span class="tb-setup__time">
                  <small>{{ lessonDay }}</small>
                  <b>{{ lessonStart }}</b>
                </span>
                <span class="tb-setup__lesson-text">
                  <b>{{ t.sampleStudent }}</b>
                  <span class="tb-muted">{{ lessonLine() }}</span>
                </span>
              </div>
              <div class="tb-setup__lesson">
                <span class="tb-setup__time tb-setup__time--tonal">
                  <small>{{ t.month }}</small>
                  <b>{{ currencySign() }}</b>
                </span>
                <span class="tb-setup__lesson-text">
                  <b>{{ t.report(monthName) }}</b>
                  <span class="tb-muted">{{ reportLine() }}</span>
                </span>
              </div>
            </div>
            <p class="tb-setup__note">
              <i class="tb-i tb-i-schedule" aria-hidden="true"></i>{{ t.zoneLater }}
            </p>
          }
          @case ('rules') {
            <span class="tb-setup__cap">{{ t.howItWorks }}</span>
            @for (example of examples(); track example.icon) {
              <p class="tb-setup__example">
                <i class="tb-i" [class]="example.icon" aria-hidden="true"></i>
                <span
                  ><b>{{ example.title }}</b
                  >{{ example.text }}</span
                >
              </p>
            }
          }
          @case ('done') {
            <span class="tb-setup__cap">{{ t.configured }}</span>
            <ul class="tb-tiles tb-setup__summary">
              @for (row of summary(); track row.label) {
                <li class="tb-tile">
                  <span class="tb-tile__text">
                    <span>{{ row.label }}</span>
                    <b>{{ row.value }}</b>
                  </span>
                  <p-button
                    icon="tb-i tb-i-edit"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [ariaLabel]="t.edit(row.label)"
                    (onClick)="goTo(row.step)"
                  />
                </li>
              }
            </ul>
            <small class="tb-hint">{{ t.changeLater }}</small>
          }
        }
      </aside>
    </ng-template>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background: var(--p-md-surface-container);
      color: var(--p-md-on-surface);
    }

    /* the top bar of the page (sketch OnbPortal: 64 dp, the logo, «Первый вход», the step, «Выйти») */
    .tb-setup__bar {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-height: 4rem;
      padding: 0 var(--tb-space-6);
    }

    .tb-setup__title {
      flex: 1;
      font: var(--tb-type-title-m);
    }

    /* the pane: a surface sheet with 28 dp corners, three columns from large (our decision) */
    .tb-setup__pane {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(13.75rem, 17.5rem) minmax(0, 1fr);
      grid-template-areas:
        'steps main'
        'steps aside';
      gap: var(--tb-space-6) var(--tb-space-8);
      align-content: start;
      margin: 0 var(--tb-space-6) var(--tb-space-6);
      padding: var(--tb-space-8);
      border-radius: var(--tb-shape-xl);
      background: var(--p-md-surface);
    }

    @media (width >= 75em) {
      .tb-setup__pane {
        grid-template-columns: minmax(13.75rem, 17.5rem) minmax(0, 1.2fr) minmax(18.75rem, 1fr);
        grid-template-areas: 'steps main aside';
        align-items: start;
      }
    }

    /* the vertical stepper (our decision: M3 publishes no stepper; rows as the list items of a nav rail) */
    .tb-setup__steps {
      grid-area: steps;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: var(--tb-space-3);
        min-height: 3.5rem;
        padding: 0 var(--tb-space-4);
        border-radius: var(--tb-shape-full);
        color: var(--p-md-on-surface-variant);
        font: var(--tb-type-label-l);
      }

      .tb-setup__step--current {
        background: var(--p-md-secondary-container);
        color: var(--p-md-on-secondary-container);
      }
    }

    .tb-setup__number {
      display: inline-flex;
      flex: 0 0 1.75rem;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 1px solid var(--p-md-outline);
      border-radius: var(--tb-shape-full);
      font: var(--tb-type-label-m);

      .tb-i {
        font-size: 1.125rem;
      }
    }

    .tb-setup__step--current .tb-setup__number {
      border-color: var(--p-md-on-secondary-container);
      background: var(--p-md-on-secondary-container);
      color: var(--p-md-secondary-container);
    }

    .tb-setup__step--done .tb-setup__number {
      border-color: var(--p-md-primary);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
    }

    .tb-setup__main {
      grid-area: main;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-5);
      min-width: 0;
      max-width: 44rem;
    }

    .tb-setup__heading {
      margin: 0;
      font: var(--tb-type-headline-l);
    }

    .tb-setup__lead {
      margin: 0 0 var(--tb-space-5);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-l);
    }

    .tb-setup__two {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
      gap: var(--tb-space-3);
      align-items: start;
    }

    .tb-setup__shared-hint {
      display: flex;
      gap: var(--tb-space-1);

      .tb-i {
        font-size: 1rem;
      }
    }

    .tb-setup__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
      margin-block-start: var(--tb-space-5);
    }

    /* «Готово»: the next steps as cards, two columns (sketch OnbDone) */
    .tb-setup__next {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-setup__card {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      width: 100%;
      height: 100%;
      padding: var(--tb-space-5);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface-container-lowest);
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--p-md-surface-container-lowest)
        );
      }

      b {
        font: var(--tb-type-title-m);
      }
    }

    .tb-setup__card--hero {
      border-color: var(--p-md-secondary-container);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-setup__card-icon {
        background: var(--p-md-primary);
        color: var(--p-md-on-primary);
      }
    }

    .tb-setup__card-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-low);
      color: var(--p-md-primary);
    }

    .tb-setup__card-text {
      font: var(--tb-type-body-m);
    }

    .tb-setup__card-state {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin-block-start: auto;
      font: var(--tb-type-label-l);

      .tb-i {
        font-size: 1.125rem;
      }
    }

    /* the example column */
    .tb-setup__aside {
      grid-area: aside;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      min-width: 0;
      max-width: 44rem;
    }

    .tb-setup__cap {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      text-transform: uppercase;
    }

    .tb-setup__preview {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-5);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface-container);
    }

    .tb-setup__preview--center {
      align-items: center;
    }

    .tb-setup__login {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      align-items: center;
      width: 100%;
      max-width: 20rem;
      padding: var(--tb-space-5);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface);
      text-align: center;
    }

    .tb-setup__login-name {
      font: var(--tb-type-title-l);
    }

    .tb-setup__login-field {
      width: 100%;
      height: 2.5rem;
      border-radius: var(--tb-shape-xs) var(--tb-shape-xs) 0 0;
      background: var(--p-md-surface-container-highest);
    }

    .tb-setup__login-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
      font: var(--tb-type-label-l);
    }

    .tb-setup__bubble {
      align-self: stretch;
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg) var(--tb-shape-lg) var(--tb-shape-lg) var(--tb-shape-xs);
      background: var(--p-md-surface-container-lowest);
      font: var(--tb-type-body-m);
      overflow-wrap: anywhere;
    }

    .tb-setup__link {
      color: var(--p-md-primary);
    }

    .tb-setup__lesson {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-lowest);
    }

    .tb-setup__time {
      display: flex;
      flex: 0 0 4.5rem;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 4.5rem;
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);

      small {
        font: var(--tb-type-label-m);
      }

      b {
        font: var(--tb-type-title-l-emphasized);
      }
    }

    .tb-setup__time--tonal {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-setup__lesson-text {
      display: flex;
      flex-direction: column;
      min-width: 0;

      b {
        font: var(--tb-type-title-m);
      }
    }

    .tb-setup__note,
    .tb-setup__example {
      display: flex;
      gap: var(--tb-space-3);
      align-items: flex-start;
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      font: var(--tb-type-body-m);
    }

    .tb-setup__note {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-setup__example {
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface-container);

      .tb-i {
        color: var(--p-md-primary);
      }

      b {
        display: block;
        margin-block-end: var(--tb-space-1);
        font: var(--tb-type-title-s);
      }
    }

    .tb-setup__summary {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* compact and medium (sketch OnbPhone): the window is the surface, one column, «Далее» at the bottom */
    :host(.tb-setup--compact) {
      background: var(--p-md-surface);

      .tb-setup__bar {
        gap: var(--tb-space-1);
        padding: 0 var(--tb-space-1);
      }

      .tb-setup__logo {
        margin-inline: var(--tb-space-3);
      }

      .tb-setup__pane {
        display: flex;
        flex-direction: column;
        gap: var(--tb-space-4);
        margin: 0;
        padding: var(--tb-space-4);
        border-radius: 0;
      }

      .tb-setup__main {
        display: contents;
      }

      .tb-setup__heading {
        font: var(--tb-type-headline-s);
      }

      .tb-setup__lead {
        margin-block-end: var(--tb-space-1);
        font: var(--tb-type-body-m);
      }

      .tb-setup__aside {
        margin-block-start: var(--tb-space-2);
      }

      /* the bar's own sides are the pane's 16 px */
      .tb-setup__actions {
        margin: var(--tb-space-2) calc(-1 * var(--tb-space-4)) calc(-1 * var(--tb-space-4));
        padding-block-end: calc(var(--tb-space-3) + env(safe-area-inset-bottom));

        > p-button {
          flex: 1;
        }
      }
    }

    :host ::ng-deep .tb-setup__progress {
      height: 0.25rem;
      margin: 0 var(--tb-space-4);
    }

    :host(.tb-setup--compact) .tb-setup__actions ::ng-deep .p-button {
      width: 100%;
    }
  `,
})
export class SetupPage implements OnInit {
  protected readonly t = t;
  private readonly settingsApi = inject(SettingsApi);
  private readonly identity = inject(IdentityApi);
  private readonly billing = inject(BillingApi);
  private readonly schedule = inject(ScheduleApi);
  private readonly homework = inject(HomeworkApi);
  private readonly aiApi = inject(AiApi);
  private readonly auth = inject(AuthService);
  private readonly portal = inject(Portal);
  private readonly router = inject(Router);
  private readonly size = injectWindowSize();

  protected readonly state = new LoadState();
  /** Compact and medium: the progress bar instead of the stepper (sketch OnbPhone). */
  protected readonly compact = computed(() => {
    const size = this.size();
    return size === 'compact' || size === 'medium';
  });

  /** The password step is there only when the password was generated (decided on opening). */
  protected readonly steps = signal<readonly Step[]>(
    STEPS.filter((step) => step.id !== 'password' || this.passwordRequired()),
  );
  readonly current = signal<StepId>(this.steps()[0]?.id ?? 'portal');
  protected readonly currentIndex = computed(() =>
    this.steps().findIndex((step) => step.id === this.current()),
  );
  protected readonly stepOf = computed(() =>
    t.stepOf(this.currentIndex() + 1, this.steps().length),
  );
  protected readonly percent = computed(() =>
    Math.round(((this.currentIndex() + 1) * 100) / this.steps().length),
  );
  protected readonly heading = computed(() => {
    switch (this.current()) {
      case 'password':
        return t.passwordTitle;
      case 'done':
        return t.doneTitle;
      default:
        return this.steps()[this.currentIndex()]?.title ?? '';
    }
  });
  protected readonly asideTitle = computed(() => {
    switch (this.current()) {
      case 'portal':
        return t.studentSees;
      case 'time':
        return t.inSchedule;
      case 'rules':
        return t.howItWorks;
      default:
        return t.configured;
    }
  });
  /** «Назад» never returns to the password: it is changed already. */
  protected readonly canGoBack = computed(() => {
    const previous = this.steps()[this.currentIndex() - 1];
    return previous !== undefined && previous.id !== 'password';
  });
  protected readonly skippable = computed(
    () => this.current() !== 'password' && this.current() !== 'done',
  );

  protected readonly pending = signal(false);
  readonly saved = signal<Saved | null>(null);
  protected readonly account = signal<Account | null>(null);

  readonly portalForm = new FormGroup({
    teacherName: new FormControl('', { nonNullable: true, validators: TEACHER_NAME_VALIDATORS }),
    portalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PORTAL_NAME_LENGTH)],
    }),
    address: new FormControl('', { nonNullable: true, validators: [portalAddressValidator] }),
  });
  readonly timeForm = new FormGroup({
    zone: new FormControl('', { nonNullable: true }),
    duration: new FormControl<number | null>(null),
    currency: new FormControl('', { nonNullable: true }),
    price: new FormControl<number | null>(null, [Validators.min(0)]),
  });
  readonly rulesForm = new FormGroup({
    late: new FormControl<number | null>(null),
    dueSoon: new FormControl<number | null>(null),
    horizon: new FormControl<number | null>(null),
  });
  readonly reminders = signal<readonly number[]>([]);

  private readonly portalValues = toSignal(this.portalForm.valueChanges, {
    initialValue: this.portalForm.getRawValue(),
  });
  private readonly timeValues = toSignal(this.timeForm.valueChanges, {
    initialValue: this.timeForm.getRawValue(),
  });
  private readonly rulesValues = toSignal(this.rulesForm.valueChanges, {
    initialValue: this.rulesForm.getRawValue(),
  });

  protected readonly portalName = computed(
    () => nonEmpty(this.portalValues().portalName?.trim()) ?? DEFAULT_PORTAL_NAME,
  );
  protected readonly teacherName = computed(() => this.portalValues().teacherName?.trim() ?? '');
  protected readonly inviteLink = computed(() => {
    const address = nonEmpty(this.portalValues().address?.trim()) ?? this.portal.openedAt();
    return `${address.replace(/^https?:\/\//, '')}/invite/…`;
  });

  /** The currency as the price shows it: the chosen one, or the locked one. */
  protected readonly currency = computed(
    () => nonEmpty(this.timeValues().currency) ?? this.saved()?.currency ?? null,
  );
  protected readonly currencySign = computed(() => {
    const code = this.currency() ?? 'RUB';
    return (
      new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    );
  });

  private readonly lesson = sampleLesson();
  private readonly timeFormat = new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
  protected readonly lessonDay = new Intl.DateTimeFormat(locale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(this.lesson);
  protected readonly lessonStart = this.timeFormat.format(this.lesson);
  protected readonly monthName = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(
    new Date(),
  );
  protected readonly lessonLine = computed(() => {
    const values = this.timeValues();
    const minutes = values.duration ?? this.saved()?.rules.defaultDurationMinutes ?? 60;
    const end = new Date(this.lesson.getTime() + minutes * 60_000);
    const span = `${this.lessonStart}–${this.timeFormat.format(end)}`;
    const price = values.price ?? 0;
    const currency = this.currency();
    return price > 0 && currency !== null
      ? `${span} · ${formatMoney(toMinorUnits(price, currency), currency)}`
      : span;
  });
  protected readonly reportLine = computed(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const day = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(last);
    return t.reportSpan(day, zoneLabel(this.timeValues().zone ?? ''));
  });

  protected readonly examples = computed(() => {
    const values = this.rulesValues();
    const saved = this.saved();
    const late = values.late ?? (saved?.rules.lateCancellationMinutes ?? 0) / HOUR;
    const dueSoon = values.dueSoon ?? (saved?.dueSoon ?? 0) / HOUR;
    const horizon = values.horizon ?? saved?.rules.horizonWeeks ?? 0;
    return [
      { icon: 'tb-i-event_busy', title: t.lateTitle, text: lateExample(late * HOUR) },
      {
        icon: 'tb-i-notifications',
        title: t.remindersTitle,
        text: remindersExample(this.reminders()),
      },
      {
        icon: 'tb-i-assignment_late',
        title: t.dueSoonTitle,
        text: dueSoonExample(dueSoon * HOUR),
      },
      { icon: 'tb-i-event_repeat', title: t.horizonTitle, text: horizonExample(horizon) },
    ];
  });

  /** What «Готово» shows was set up: the values as saved (a skipped step shows the server's). */
  protected readonly summary = computed<SummaryRow[]>(() => {
    const saved = this.saved();
    if (saved === null) {
      return [];
    }
    const { portal, rules } = saved;
    const host = (portal.address ?? this.portal.openedAt()).replace(/^https?:\/\//, '');
    const length = spanLabel(rules.defaultDurationMinutes);
    const reminders = [...rules.reminderMinutes]
      .sort((a, b) => b - a)
      .map((minutes) => T.page.before(spanLabel(minutes)).toLocaleLowerCase(locale()));
    return [
      {
        label: t.summaryPortal,
        value: `${nonEmpty(portal.name) ?? DEFAULT_PORTAL_NAME} · ${host}`,
        step: 'portal',
      },
      { label: t.summaryZone, value: zoneLabel(saved.zone), step: 'time' },
      {
        label: t.summaryLesson,
        value: saved.price > 0 ? `${length} · ${formatMoney(saved.price, saved.currency)}` : length,
        step: 'time',
      },
      {
        label: t.summaryLate,
        value:
          rules.lateCancellationMinutes > 0
            ? t.lessThan(spanLabel(rules.lateCancellationMinutes))
            : t.off,
        step: 'rules',
      },
      {
        label: t.summaryReminders,
        value:
          reminders.length > 0
            ? `${reminders.slice(0, -1).join(', ')}${reminders.length > 1 ? t.and : ''}${reminders.at(-1) ?? ''}`
            : t.off,
        step: 'rules',
      },
      { label: t.summaryDueSoon, value: t.remindBefore(spanLabel(saved.dueSoon)), step: 'rules' },
    ];
  });

  /** The states of the next steps, once asked when «Готово» opens. */
  private readonly states = signal<
    Partial<Record<NextCard['id'], { state: string; done: boolean }>>
  >({});
  protected readonly nextCards = computed<NextCard[]>(() => {
    const states = this.states();
    const card = (id: NextCard['id'], rest: Omit<NextCard, 'id' | 'state' | 'done'>): NextCard => ({
      id,
      ...rest,
      state: states[id]?.state ?? null,
      done: states[id]?.done ?? false,
    });
    return [
      card('student', {
        icon: 'tb-i-person_add',
        title: t.addStudent,
        text: t.addStudentText,
        link: '/teacher/students',
        query: { create: 'student' },
      }),
      card('messenger', {
        icon: 'tb-i-forum',
        title: t.connectMessenger,
        text: t.connectMessengerText,
        link: '/teacher/settings/messengers',
      }),
      card('ai', {
        icon: 'tb-i-auto_awesome',
        title: t.connectAi,
        text: t.connectAiText,
        link: '/teacher/settings/ai',
      }),
      card('google', {
        icon: 'tb-i-event',
        title: t.google,
        text: t.googleText,
        link: '/teacher/settings/lessons',
      }),
    ];
  });
  private statesAsked = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    forkJoin({
      account: this.identity.account(),
      portal: this.settingsApi.portal(),
      zone: this.schedule.settings().pipe(map((settings) => settings.timeZone)),
      rules: this.schedule.lessonRules(),
      currency: this.billing.currency(),
      overview: this.billing.overview(quietContext()),
      dueSoon: this.homework.settings().pipe(map((settings) => settings.dueSoonMinutes)),
    })
      .pipe(this.state.track())
      .subscribe(({ account, portal, zone, rules, currency, overview, dueSoon }) => {
        this.account.set(account);
        this.saved.set({
          account,
          portal,
          zone,
          currency: currency.currency,
          locked: currency.locked,
          price: overview.defaultLessonPrice,
          rules,
          dueSoon,
        });
        this.showPortal();
        this.showTime(deviceZone());
        this.showRules();
        if (this.current() === 'done') {
          this.askStates();
        }
      });
  }

  protected passwordChanged(): void {
    this.move(1);
  }

  /** Saves the step, then the next one opens. */
  next(): void {
    if (this.pending()) {
      return;
    }
    const step = this.current();
    const request = this.request(step);
    if (request === null) {
      return;
    }
    this.pending.set(true);
    request.subscribe({
      next: () => {
        this.pending.set(false);
        this.move(1);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  /** The next step without saving this one: its fields show what the server keeps. */
  skip(): void {
    switch (this.current()) {
      case 'portal':
        this.showPortal();
        break;
      case 'time':
        this.showTime();
        break;
      case 'rules':
        this.showRules();
        break;
      default:
        return;
    }
    this.move(1);
  }

  back(): void {
    if (this.canGoBack()) {
      this.move(-1);
    }
  }

  /** «Изменить» of «Что вы настроили». */
  goTo(step: StepId): void {
    this.open(step);
  }

  /** Finishing marks the setup done (the wizard does not open again), then opens the page. */
  finish(link: string, query?: Readonly<Record<string, string>>): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.settingsApi.completeSetup().subscribe({
      next: () => {
        this.pending.set(false);
        this.portal.setSetupCompleted(true);
        void this.router.navigate([link], { queryParams: query });
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  protected signOut(): void {
    this.auth.logout().subscribe();
  }

  protected photoChanged(account: Account): void {
    this.account.set(account);
    this.auth.profileChanged(account);
  }

  protected passwordRequired(): boolean {
    return this.auth.user()?.passwordChangeRequired === true;
  }

  private move(by: number): void {
    const step = this.steps()[this.currentIndex() + by];
    if (step !== undefined) {
      this.open(step.id);
    }
  }

  private open(step: StepId): void {
    this.current.set(step);
    if (step === 'done') {
      this.askStates();
    }
  }

  /** The requests that save a step (none when nothing changed), or `null` when a field is wrong. */
  private request(step: StepId): Observable<unknown> | null {
    const saved = this.saved();
    if (saved === null) {
      return null;
    }
    switch (step) {
      case 'portal':
        return revealErrors(this.portalForm) ? this.savePortal(saved) : null;
      case 'time':
        return this.saveTime(saved);
      case 'rules':
        return this.saveRules(saved);
      default:
        return of(null);
    }
  }

  private savePortal(saved: Saved): Observable<unknown> {
    const { teacherName, portalName, address } = this.portalForm.getRawValue();
    const name = teacherName.trim();
    const requests: Observable<unknown>[] = [];
    if (name !== saved.account.displayName) {
      requests.push(
        this.identity.renameTeacher(name).pipe(
          tap((account) => {
            this.account.set(account);
            this.auth.profileChanged(account);
            this.update({ account });
          }),
        ),
      );
    }
    if (
      portalName.trim() !== saved.portal.name ||
      address.trim() !== (saved.portal.address ?? '')
    ) {
      requests.push(
        this.settingsApi.changePortal(portalName.trim(), address.trim()).pipe(
          tap((portal) => {
            this.portal.set(portal);
            this.update({ portal });
          }),
        ),
      );
    }
    return all(requests);
  }

  private saveTime(saved: Saved): Observable<unknown> {
    const { zone, duration, currency, price } = this.timeForm.getRawValue();
    const requests: Observable<unknown>[] = [];
    if (zone !== '' && zone !== saved.zone) {
      requests.push(
        this.settingsApi.changeTimeZone(zone).pipe(
          tap((changed) => {
            this.update({ zone: changed.timeZone });
          }),
        ),
      );
    }
    if (!saved.locked && currency !== '' && currency !== saved.currency) {
      requests.push(
        this.billing.changeCurrency(currency).pipe(
          tap((changed) => {
            this.update({ currency: changed.currency, locked: changed.locked });
          }),
        ),
      );
    }
    const code = !saved.locked && currency !== '' ? currency : saved.currency;
    const minor = price === null ? saved.price : toMinorUnits(price, code);
    if (minor !== saved.price || code !== saved.currency) {
      requests.push(
        this.billing.changeDefaultPrice(minor).pipe(
          tap((changed) => {
            this.update({ price: changed });
          }),
        ),
      );
    }
    const minutes = duration ?? saved.rules.defaultDurationMinutes;
    if (minutes !== saved.rules.defaultDurationMinutes) {
      requests.push(this.changeRules({ ...saved.rules, defaultDurationMinutes: minutes }));
    }
    return all(requests);
  }

  private saveRules(saved: Saved): Observable<unknown> {
    const { late, dueSoon, horizon } = this.rulesForm.getRawValue();
    const rules: LessonRules = {
      defaultDurationMinutes: saved.rules.defaultDurationMinutes,
      lateCancellationMinutes:
        late === null ? saved.rules.lateCancellationMinutes : Math.round(late * HOUR),
      reminderMinutes: this.reminders(),
      horizonWeeks: horizon ?? saved.rules.horizonWeeks,
    };
    const requests: Observable<unknown>[] = [this.changeRules(rules)];
    const minutes = dueSoon === null ? saved.dueSoon : Math.round(dueSoon * HOUR);
    if (minutes !== saved.dueSoon) {
      requests.push(
        this.homework.changeSettings({ dueSoonMinutes: minutes }).pipe(
          tap((changed) => {
            this.update({ dueSoon: changed.dueSoonMinutes });
          }),
        ),
      );
    }
    return all(requests);
  }

  private changeRules(rules: LessonRules): Observable<LessonRules> {
    return this.schedule.changeLessonRules(rules).pipe(
      tap((changed) => {
        this.update({ rules: changed });
      }),
    );
  }

  private update(change: Partial<Saved>): void {
    this.saved.update((saved) => (saved === null ? saved : { ...saved, ...change }));
  }

  /** «Вы и портал» as saved; the address — the stored one, else where the portal is open now. */
  private showPortal(): void {
    const saved = this.saved();
    if (saved === null) {
      return;
    }
    this.portalForm.reset({
      teacherName: saved.account.displayName,
      portalName: saved.portal.name,
      address: saved.portal.address ?? this.portal.openedAt(),
    });
  }

  /** «Время и оплата» as saved; on opening the device's zone is suggested instead (sketch OnbTime). */
  private showTime(zone?: string): void {
    const saved = this.saved();
    if (saved === null) {
      return;
    }
    this.timeForm.reset({
      zone: zone ?? saved.zone,
      duration: saved.rules.defaultDurationMinutes,
      currency: saved.currency,
      price: toMajorUnits(saved.price, saved.currency),
    });
    if (saved.locked) {
      this.timeForm.controls.currency.disable();
    } else {
      this.timeForm.controls.currency.enable();
    }
  }

  private showRules(): void {
    const saved = this.saved();
    if (saved === null) {
      return;
    }
    this.rulesForm.reset({
      late: saved.rules.lateCancellationMinutes / HOUR,
      dueSoon: saved.dueSoon / HOUR,
      horizon: saved.rules.horizonWeeks,
    });
    this.reminders.set([...saved.rules.reminderMinutes]);
  }

  /** The states of the cards of «Готово», once; a state that cannot be read is left out. */
  private askStates(): void {
    if (this.statesAsked) {
      return;
    }
    this.statesAsked = true;
    const set = (id: NextCard['id'], state: string, done: boolean): void => {
      this.states.update((states) => ({ ...states, [id]: { state, done } }));
    };
    this.identity
      .listStudents(quietContext())
      .pipe(catchError(() => of(null)))
      .subscribe((students) => {
        if (students !== null && students.length > 0) {
          set('student', t.students(students.length), true);
        }
      });
    this.settingsApi
      .notificationsStatus()
      .pipe(catchError(() => of(null)))
      .subscribe((status) => {
        if (status !== null) {
          set(
            'messenger',
            messengersState(status),
            status.channels.some((channel) => channel.connection === 'OK'),
          );
        }
      });
    this.aiApi
      .status(true)
      .pipe(catchError(() => of(null)))
      .subscribe((status) => {
        if (status !== null) {
          set('ai', aiState(status), status.enabled);
        }
      });
    this.schedule
      .googleStatus()
      .pipe(catchError(() => of(null)))
      .subscribe((status) => {
        if (status?.status === 'CONNECTED') {
          set('google', t.connected, true);
        } else if (status?.status === 'NEEDS_RECONNECT') {
          set('google', t.reconnect, false);
        }
      });
  }
}

/** `null` for an empty or missing text. */
function nonEmpty(text: string | undefined): string | null {
  return text === undefined || text === '' ? null : text;
}

/** The requests one after another (a price after its currency); none — at once. */
function all(requests: readonly Observable<unknown>[]): Observable<unknown> {
  return requests.length === 0 ? of(null) : concat(...requests).pipe(toArray());
}
