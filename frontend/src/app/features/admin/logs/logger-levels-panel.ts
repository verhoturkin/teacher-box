import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { LogLevelName, LoggerLevel } from '../data-access/admin.models';
import { LEVELS, levelSeverity } from '../admin-labels';

export const DURATIONS: readonly { readonly label: string; readonly minutes: number }[] = [
  { label: '15 минут', minutes: 15 },
  { label: '30 минут', minutes: 30 },
  { label: '1 час', minutes: 60 },
  { label: '4 часа', minutes: 240 },
];

/** Temporary log levels: more details for a part of the application, the previous level comes back by itself. */
@Component({
  selector: 'tb-logger-levels-panel',
  imports: [DatePipe, ReactiveFormsModule, Button, Card, Select, TableModule, Tag, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Подробный журнал">
      <p class="tb-muted">
        Уровень DEBUG записывает больше подробностей для выбранного раздела. Через заданное время уровень вернётся
        сам.
      </p>
      <form class="tb-levels-form" [formGroup]="form" (ngSubmit)="apply()">
        <p-select
          formControlName="name"
          [options]="names()"
          [editable]="true"
          placeholder="Раздел, например ru.teacherbox.notifications"
          ariaLabel="Раздел журнала"
          appendTo="body"
          [fluid]="true"
          class="tb-levels-form__name"
        />
        <p-select formControlName="level" [options]="levels" ariaLabel="Уровень" appendTo="body" />
        <p-select
          formControlName="minutes"
          [options]="durations"
          optionLabel="label"
          optionValue="minutes"
          ariaLabel="На сколько"
          appendTo="body"
        />
        <p-button type="submit" label="Применить" [disabled]="form.invalid" [loading]="pending()" />
      </form>
      <p-table [value]="loggers()" styleClass="p-datatable-sm">
        <ng-template #header>
          <tr>
            <th>Раздел</th>
            <th>Уровень</th>
            <th>Вернётся</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-logger [tbRowType]="loggers()">
          <tr>
            <td class="tb-logger-name">{{ logger.name }}</td>
            <td><p-tag [value]="logger.effectiveLevel" [severity]="severity(logger.effectiveLevel)" /></td>
            <td>{{ logger.revertAt === null ? '—' : (logger.revertAt | date: 'dd.MM HH:mm') }}</td>
            <td class="tb-row-actions">
              @if (logger.revertAt !== null) {
                <p-button label="Вернуть" size="small" [text]="true" (onClick)="revert(logger.name)" />
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </p-card>
  `,
  styles: `
    .tb-levels-form {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .tb-levels-form__name {
      flex: 1;
      min-width: 16rem;
    }

    .tb-logger-name {
      overflow-wrap: anywhere;
      font-family: monospace;
    }

    .tb-row-actions {
      text-align: right;
    }
  `,
})
export class LoggerLevelsPanel implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly messages = inject(MessageService);

  protected readonly levels = [...LEVELS];
  protected readonly durations = [...DURATIONS];
  protected readonly loggers = signal<LoggerLevel[]>([]);
  protected readonly names = signal<string[]>([]);
  protected readonly pending = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('ru.teacherbox', { nonNullable: true, validators: [Validators.required] }),
    level: new FormControl<LogLevelName>('DEBUG', { nonNullable: true }),
    minutes: new FormControl(30, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.reload();
  }

  protected severity(level: string): ReturnType<typeof levelSeverity> {
    return levelSeverity(level);
  }

  apply(): void {
    if (this.form.invalid) {
      return;
    }
    const { name, level, minutes } = this.form.getRawValue();
    this.pending.set(true);
    this.api.changeLevel(name.trim(), level, minutes).subscribe({
      next: (changed) => {
        this.pending.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Уровень изменён',
          detail: `${changed.name}: ${changed.effectiveLevel}`,
        });
        this.reload();
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  revert(name: string): void {
    this.api.revertLevel(name).subscribe(() => {
      this.reload();
    });
  }

  private reload(): void {
    this.api.loggers().subscribe((loggers) => {
      this.loggers.set(loggers);
      this.names.set(loggers.map((logger) => logger.name));
    });
  }
}
