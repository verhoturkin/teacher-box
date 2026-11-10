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
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, concat, forkJoin, map, of, tap, toArray } from 'rxjs';
import { Button } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { AuthService } from '@core/auth/auth.service';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectWindowSize } from '@core/layout/mobile';
import { Portal } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH, portalAddressValidator } from '@core/portal/portal-address';
import { PortalLogo } from '@core/portal/portal-logo';
import { AiApi } from '@features/ai/parts';
import { BillingApi } from '@features/billing/parts';
import { HelpButton } from '@features/help/parts';
import { HomeworkApi } from '@features/homework/parts';
import { Account, IdentityApi, TEACHER_NAME_VALIDATORS } from '@features/identity/parts';
import { LessonRules, ScheduleApi } from '@features/schedule/parts';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { revealErrors } from '@shared/ui/field-errors';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { ProgressLabel } from '@shared/ui/progress-label.directive';
import { SettingsApi } from '../data-access/settings-api';
import { T } from '../i18n/texts';
import { deviceZone } from '../lesson-options';
import { HOUR } from '../lesson-rules';
import { aiState, messengersState } from '../settings-categories';
import { NextCardId, NextStates, SetupDonePreview, SetupDoneStep } from './steps/done-step';
import { SetupPasswordStep } from './steps/password-step';
import { SetupPortalPreview, SetupPortalStep } from './steps/portal-step';
import { SetupRulesPreview, SetupRulesStep } from './steps/rules-step';
import { Saved, StepId, nonEmpty } from './steps/setup-state';
import { SetupTimePreview, SetupTimeStep } from './steps/time-step';

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
    Button,
    ProgressBar,
    HelpButton,
    LoadStateView,
    PortalLogo,
    ProgressLabel,
    SetupDonePreview,
    SetupDoneStep,
    SetupPasswordStep,
    SetupPortalPreview,
    SetupPortalStep,
    SetupRulesPreview,
    SetupRulesStep,
    SetupTimePreview,
    SetupTimeStep,
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
          <p class="tb-setup__lead">{{ lead() }}</p>
          @switch (current()) {
            @case ('password') {
              <tb-setup-password-step (changed)="passwordChanged()" />
            }
            @case ('portal') {
              <tb-setup-portal-step
                [form]="portalForm"
                [account]="account()"
                (submitted)="next()"
                (photoChanged)="photoChanged($event)"
              />
            }
            @case ('time') {
              <tb-setup-time-step
                [form]="timeForm"
                [locked]="saved()?.locked ?? false"
                [currency]="currency()"
                (submitted)="next()"
              />
            }
            @case ('rules') {
              <tb-setup-rules-step
                [form]="rulesForm"
                [(reminders)]="reminders"
                (submitted)="next()"
              />
            }
            @case ('done') {
              <tb-setup-done-step
                [states]="states()"
                [pending]="pending()"
                (opened)="finish($event.link, $event.query)"
              />
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
        @if (current() !== 'password') {
          <span class="tb-setup__cap">{{ asideTitle() }}</span>
        }
        @switch (current()) {
          @case ('portal') {
            <tb-setup-portal-preview [values]="portalValues()" />
          }
          @case ('time') {
            <tb-setup-time-preview
              [values]="timeValues()"
              [currency]="currency()"
              [saved]="saved()"
            />
          }
          @case ('rules') {
            <tb-setup-rules-preview
              [values]="rulesValues()"
              [reminders]="reminders()"
              [saved]="saved()"
            />
          }
          @case ('done') {
            <tb-setup-done-preview [saved]="saved()" (edit)="goTo($event)" />
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

    .tb-setup__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
      margin-block-start: var(--tb-space-5);
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
  /** The lead under the heading of the step. */
  protected readonly lead = computed(() => {
    switch (this.current()) {
      case 'password':
        return t.passwordText;
      case 'portal':
        return t.portalLead;
      case 'time':
        return t.timeLead;
      case 'rules':
        return t.rulesLead;
      default:
        return t.doneLead;
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

  protected readonly portalValues = toSignal(this.portalForm.valueChanges, {
    initialValue: this.portalForm.getRawValue(),
  });
  protected readonly timeValues = toSignal(this.timeForm.valueChanges, {
    initialValue: this.timeForm.getRawValue(),
  });
  protected readonly rulesValues = toSignal(this.rulesForm.valueChanges, {
    initialValue: this.rulesForm.getRawValue(),
  });

  /** The currency as the price shows it: the chosen one, or the locked one. */
  protected readonly currency = computed(
    () => nonEmpty(this.timeValues().currency) ?? this.saved()?.currency ?? null,
  );
  /** The states of the next steps, once asked when «Готово» opens. */
  protected readonly states = signal<NextStates>({});
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
    const set = (id: NextCardId, state: string, done: boolean): void => {
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

/** The requests one after another (a price after its currency); none — at once. */
function all(requests: readonly Observable<unknown>[]): Observable<unknown> {
  return requests.length === 0 ? of(null) : concat(...requests).pipe(toArray());
}
