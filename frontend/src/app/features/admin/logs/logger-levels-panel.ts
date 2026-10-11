import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { LogLevelName, LoggerLevel } from '../data-access/admin.models';
import { LEVELS, levelSeverity } from '../admin-labels';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';

export const DURATIONS: readonly { readonly label: string; readonly minutes: number }[] = [
  { label: T.levels.m15, minutes: 15 },
  { label: T.levels.m30, minutes: 30 },
  { label: T.levels.h1, minutes: 60 },
  { label: T.levels.h4, minutes: 240 },
];

/** Temporary log levels: more details for a part of the application, the previous level comes back by itself. */
@Component({
  selector: 'tb-logger-levels-panel',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    Select,
    TableModule,
    Tag,
    RowType,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <p class="tb-muted">{{ t.about }}</p>
      <form tbFieldErrors class="tb-levels-form" [formGroup]="form" (ngSubmit)="apply()">
        <div class="tb-field tb-levels-form__name">
          <label for="logger-name">{{ t.section }}</label>
          <p-select
            inputId="logger-name"
            formControlName="name"
            [options]="names()"
            [editable]="true"
            [placeholder]="t.sectionPlaceholder"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="logger-level">{{ t.level }}</label>
          <p-select
            inputId="logger-level"
            formControlName="level"
            [options]="levels"
            appendTo="body"
          />
        </div>
        <div class="tb-field">
          <label for="logger-minutes">{{ t.duration }}</label>
          <p-select
            inputId="logger-minutes"
            formControlName="minutes"
            [options]="durations"
            optionLabel="label"
            optionValue="minutes"
            appendTo="body"
          />
        </div>
        <p-button
          class="tb-tonal"
          type="submit"
          [label]="t.apply"
          severity="success"
          [loading]="pending()"
        />
      </form>
      <p-table [value]="loggers()" styleClass="tb-cards">
        <ng-template #header>
          <tr>
            <th>{{ logSection }}</th>
            <th>{{ t.level }}</th>
            <th>{{ t.reverts }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-logger [tbRowType]="loggers()">
          <tr>
            <td [attr.data-label]="logSection" class="tb-logger-name">{{ logger.name }}</td>
            <td [attr.data-label]="t.level">
              <p-tag [value]="logger.effectiveLevel" [severity]="severity(logger.effectiveLevel)" />
            </td>
            <td [attr.data-label]="t.reverts">
              {{ logger.revertAt === null ? '—' : (logger.revertAt | date: 'dd.MM HH:mm') }}
            </td>
            <td class="tb-row-actions">
              @if (logger.revertAt !== null) {
                <p-button
                  [label]="t.revert"
                  severity="danger"
                  [text]="true"
                  [ariaLabel]="t.revertOf(logger.name)"
                  [loading]="busy.is(logger.name)"
                  (onClick)="revert(logger.name)"
                />
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
      align-items: flex-end;
      gap: var(--tb-space-3) var(--tb-space-2);
      margin-bottom: var(--tb-space-4);
    }

    .tb-levels-form__name {
      flex: 1;
      min-width: 16rem;
    }

    .tb-logger-name {
      overflow-wrap: anywhere;
      font-family: var(--tb-font-mono);
    }

    .tb-row-actions {
      text-align: right;
    }
  `,
})
export class LoggerLevelsPanel implements OnInit {
  protected readonly logSection = T.log.section;
  protected readonly t = T.levels;
  protected readonly busy = new Busy();
  private readonly api = inject(AdminApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly levels = [...LEVELS];
  protected readonly durations = [...DURATIONS];
  protected readonly loggers = signal<LoggerLevel[]>([]);
  protected readonly names = signal<string[]>([]);
  protected readonly pending = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('ru.teacherbox', {
      nonNullable: true,
      validators: [Validators.required],
    }),
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
    if (!revealErrors(this.form)) {
      return;
    }
    const { name, level, minutes } = this.form.getRawValue();
    this.pending.set(true);
    this.api.changeLevel(name.trim(), level, minutes).subscribe({
      next: (changed) => {
        this.pending.set(false);
        this.snackbar.success(T.levels.changed(changed.name, changed.effectiveLevel));
        this.reload();
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  revert(name: string): void {
    this.busy.guard(name, this.api.revertLevel(name)).subscribe(() => {
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
