import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { NotificationsApi } from '../data-access/notifications-api';
import { StudentMessengers } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '../notification-labels';

/** Teacher: which students connected a messenger, delivery problems and a reminder to connect. */
@Component({
  selector: 'tb-student-messengers-panel',
  imports: [Button, Card, TableModule, Tag, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Мессенджеры учеников">
      @if (students(); as students) {
        @if (students.length === 0) {
          <p class="tb-muted">Учеников пока нет.</p>
        } @else {
          <div class="tb-students-summary">
            <span>
              Подключили мессенджер: <strong>{{ connectedCount() }}</strong> из {{ students.length }}
            </span>
            <p-button
              [label]="selection().length > 0 ? 'Напомнить выбранным' : 'Напомнить всем без мессенджера'"
              icon="pi pi-bell"
              size="small"
              [outlined]="true"
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
            styleClass="p-datatable-sm"
          >
            <ng-template #header>
              <tr>
                <th class="tb-check-column"><p-tableHeaderCheckbox /></th>
                <th>Ученик</th>
                <th>Мессенджеры</th>
                <th>Доставка</th>
              </tr>
            </ng-template>
            <ng-template #body let-row [tbRowType]="students">
              <tr>
                <td class="tb-check-column"><p-tableCheckbox [value]="row" /></td>
                <td>{{ row.displayName }}</td>
                <td>
                  @if (row.channels.length === 0) {
                    <span class="tb-muted">не подключены</span>
                  } @else {
                    <span class="tb-student-channels">
                      @for (channel of row.channels; track channel.channel) {
                        <p-tag
                          [icon]="icons[channel.channel]"
                          [value]="names[channel.channel] + (channel.enabled ? '' : ' (на паузе)')"
                          [severity]="channel.enabled ? 'success' : 'secondary'"
                        />
                      }
                    </span>
                  }
                </td>
                <td>
                  @if (row.failedDeliveries > 0) {
                    <p-tag [value]="'Не доставлено: ' + row.failedDeliveries" severity="danger" />
                  } @else {
                    <span class="tb-muted">—</span>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
          <small class="tb-hint">
            Напоминание придёт в личный кабинет ученика со ссылкой на подключение. Ученики, у которых мессенджер уже
            подключён, его не получат. «Не доставлено» — сообщения за 30 дней, которые мессенджер не принял (например,
            ученик заблокировал бота).
          </small>
        }
      }
    </p-card>
  `,
  styles: `
    .tb-students-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .tb-student-channels {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .tb-check-column {
      width: 3rem;
    }
  `,
})
export class StudentMessengersPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly messages = inject(MessageService);

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

  ngOnInit(): void {
    this.api.studentMessengers().subscribe((students) => {
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
        this.messages.add({
          severity: 'success',
          summary: 'Напоминание отправлено',
          detail: `Получили учеников: ${String(recipients)}`,
        });
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }
}
