import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { NotificationsApi } from '../data-access/notifications-api';
import { StudentMessengers } from '../data-access/notifications.models';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { injectMobile } from '@core/layout/mobile';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from '@features/identity/parts';
import { T } from '../i18n/texts';

/** A student gets the notifications in a messenger: one is connected and on, nothing bounced lately. */
function reached(student: StudentMessengers): boolean {
  return student.failedDeliveries === 0 && student.channels.some((channel) => channel.enabled);
}

/**
 * Teacher: how many students get the notifications in a messenger (sketch Messengers, «5 из 7»), the ones
 * who don't with «Отправить ссылку» (a reminder with the link to connect) and «Кто где» → the students list;
 * each student's messengers are in their card.
 */
@Component({
  selector: 'tb-student-messengers-panel',
  imports: [
    Avatar,
    Button,
    ButtonDirective,
    ButtonLabel,
    Card,
    EmptyState,
    LoadStateView,
    ProgressBar,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title" styleClass="tb-section-card tb-section-card--flow">
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (students(); as students) {
          @if (students.length === 0) {
            <tb-empty-state icon="tb-i-group" [title]="t.empty" />
          } @else {
            <div class="tb-reach-body">
              <p class="tb-reach">
                <strong class="tb-reach__count">{{ t.count(ok().length, students.length) }}</strong>
                <span class="tb-muted">{{ t.countHint }}</span>
              </p>
              <p-progressbar
                [value]="(100 * ok().length) / students.length"
                [showValue]="false"
                [attr.aria-label]="t.progress(ok().length, students.length)"
              />
              @if (missing().length > 0) {
                <h3 class="tb-section-label">{{ t.missing }}</h3>
                <ul class="tb-list tb-list--no-phone-lead">
                  @for (row of missing(); track row.studentId) {
                    <li>
                      <tb-avatar
                        class="tb-list__lead"
                        [attr.data-tb-label]="colors.studentLabel(row.studentId)"
                        [name]="row.displayName"
                        [photo]="row.avatar"
                      />
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ row.displayName }}</span>
                        <span class="tb-list__supporting">{{ why(row) }}</span>
                      </div>
                      <div class="tb-list__trail">
                        @if (mobile()) {
                          <p-button
                            icon="tb-i tb-i-share"
                            [text]="true"
                            [rounded]="true"
                            [ariaLabel]="t.sendLinkTo(row.displayName)"
                            [loading]="pending() === row.studentId"
                            (onClick)="sendLink(row.studentId)"
                          />
                        } @else {
                          <p-button
                            [label]="t.sendLink"
                            icon="tb-i tb-i-share"
                            severity="secondary"
                            [loading]="pending() === row.studentId"
                            (onClick)="sendLink(row.studentId)"
                          />
                        }
                      </div>
                    </li>
                  }
                </ul>
              }
              <div class="tb-reach__ok">
                @if (ok().length > 0) {
                  <h3 class="tb-section-label">{{ t.connected }}</h3>
                }
                <span class="tb-reach__avatars">
                  @for (row of ok(); track row.studentId) {
                    <tb-avatar
                      size="2rem"
                      [attr.data-tb-label]="colors.studentLabel(row.studentId)"
                      [attr.title]="row.displayName"
                      [name]="row.displayName"
                      [photo]="row.avatar"
                    />
                  }
                </span>
                <a pButton class="tb-reach__where" [text]="true" routerLink="/teacher/students">
                  <span pButtonLabel>{{ t.whoWhere }}</span>
                </a>
              </div>
            </div>
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    /* the blocks of the card 12 px apart, as the other settings cards (sketch Messengers) */
    .tb-reach-body {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);

      > * {
        margin: 0;
      }
    }

    .tb-reach {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--tb-space-2);
    }

    /* our decision: the count is the card's headline number, M3 headline small */
    .tb-reach__count {
      font: var(--tb-type-headline-s);
    }

    .tb-reach__ok {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1);

      .tb-section-label {
        flex-basis: 100%;
        margin: 0 0 var(--tb-space-2);
      }
    }

    .tb-reach__avatars {
      display: inline-flex;
      flex: 1;
      flex-wrap: wrap;
      gap: var(--tb-space-1);
    }

    .tb-reach__where {
      margin-inline-start: auto;
    }
  `,
})
export class StudentMessengersPanel implements OnInit {
  protected readonly t = T.students;
  protected readonly colors = inject(TeacherColors);
  protected readonly mobile = injectMobile();
  private readonly api = inject(NotificationsApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly students = signal<StudentMessengers[] | null>(null);
  /** The student a link is being sent to. */
  protected readonly pending = signal<string | null>(null);
  protected readonly ok = computed(() => (this.students() ?? []).filter(reached));
  protected readonly missing = computed(() =>
    (this.students() ?? []).filter((student) => !reached(student)),
  );

  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .studentMessengers()
      .pipe(this.state.track())
      .subscribe((students) => {
        this.students.set(students);
      });
  }

  protected why(student: StudentMessengers): string {
    if (student.failedDeliveries > 0) {
      return this.t.failed(student.failedDeliveries);
    }
    return student.channels.length === 0 ? this.t.notYet : this.t.paused;
  }

  sendLink(studentId: string): void {
    this.pending.set(studentId);
    this.api.remindToConnect([studentId]).subscribe({
      next: () => {
        this.pending.set(null);
        this.snackbar.success(this.t.sent);
      },
      error: () => {
        this.pending.set(null);
      },
    });
  }
}
