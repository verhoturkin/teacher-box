import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { NotificationsApi } from '../data-access/notifications-api';
import { StudentMessengers } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '../notification-labels';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { Avatar } from '@shared/ui/avatar';
import { TeacherColors } from '@features/identity/parts';
import { T } from '../i18n/texts';

/** Teacher: which students connected a messenger, delivery problems and a reminder to connect. */
@Component({
  selector: 'tb-student-messengers-panel',
  imports: [Avatar, EmptyState, Button, Card, TableModule, Tag, RowType, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (students(); as students) {
          @if (students.length === 0) {
            <tb-empty-state icon="tb-i-group" [title]="t.empty" />
          } @else {
            <div class="tb-students-summary">
              <span>
                {{ t.connectedBefore }} <strong>{{ connectedCount() }}</strong>
                {{ t.of(students.length) }}
              </span>
              <p-button
                [label]="selection().length > 0 ? t.remindSelected : t.remindAll"
                icon="tb-i tb-i-notifications"
                severity="secondary"
                [disabled]="notConnected().length === 0"
                [loading]="pending()"
                (onClick)="remind()"
              />
            </div>
            <p-table
              [value]="students"
              dataKey="studentId"
              [selection]="selection()"
              (selectionChange)="onSelection($event)"
              styleClass="tb-cards"
            >
              <ng-template #header>
                <tr>
                  <th class="tb-check-column"><p-tableHeaderCheckbox /></th>
                  <th class="tb-col-main">{{ t.student }}</th>
                  <th>{{ t.messengers }}</th>
                  <th>{{ t.delivery }}</th>
                </tr>
              </ng-template>
              <ng-template #body let-row [tbRowType]="students">
                <tr>
                  <td class="tb-check-column"><p-tableCheckbox [value]="row" /></td>
                  <td [attr.data-label]="t.student">
                    <div class="tb-person">
                      <tb-avatar
                        [attr.data-tb-label]="colors.studentLabel(row.studentId)"
                        [name]="row.displayName"
                        [photo]="row.avatar"
                      />
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ row.displayName }}</span>
                      </div>
                    </div>
                  </td>
                  <td [attr.data-label]="t.messengers">
                    @if (row.channels.length === 0) {
                      <span class="tb-muted">{{ t.none }}</span>
                    } @else {
                      <span class="tb-student-channels">
                        @for (channel of row.channels; track channel.channel) {
                          <p-tag
                            [icon]="icons[channel.channel]"
                            [value]="
                              channel.enabled
                                ? names[channel.channel]
                                : t.paused(names[channel.channel])
                            "
                            [severity]="channel.enabled ? 'success' : 'secondary'"
                          />
                        }
                      </span>
                    }
                  </td>
                  <td [attr.data-label]="t.delivery">
                    @if (row.failedDeliveries > 0) {
                      <p-tag [value]="t.failed(row.failedDeliveries)" severity="danger" />
                    } @else {
                      <span class="tb-muted">—</span>
                    }
                  </td>
                </tr>
              </ng-template>
            </p-table>
            <small class="tb-hint">{{ t.hint }}</small>
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    .tb-students-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
      margin-bottom: var(--tb-space-3);
    }

    .tb-student-channels {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--tb-space-1);
    }

    .tb-check-column {
      width: 3rem;
    }
  `,
})
export class StudentMessengersPanel implements OnInit {
  protected readonly t = T.students;
  protected readonly colors = inject(TeacherColors);
  private readonly api = inject(NotificationsApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly names = CHANNEL_NAMES;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly students = signal<StudentMessengers[] | null>(null);
  protected readonly selection = signal<StudentMessengers[]>([]);
  protected readonly pending = signal(false);
  protected readonly connectedCount = computed(
    () => (this.students() ?? []).filter((student) => student.channels.length > 0).length,
  );
  protected readonly notConnected = computed(() =>
    (this.selection().length > 0 ? this.selection() : (this.students() ?? [])).filter(
      (student) => student.channels.length === 0,
    ),
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

  onSelection(selection: StudentMessengers[]): void {
    this.selection.set(selection);
  }

  remind(): void {
    const selected = this.selection().map((student) => student.studentId);
    this.pending.set(true);
    this.api.remindToConnect(selected).subscribe({
      next: (recipients) => {
        this.pending.set(false);
        this.snackbar.success(T.students.reminded(recipients));
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
