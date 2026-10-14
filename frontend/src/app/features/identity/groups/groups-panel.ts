import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { BillingApi } from '@features/billing/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { IdentityApi } from '../data-access/identity-api';
import { Student, StudentGroup } from '../data-access/identity.models';
import { GroupFormDialog, SavedGroup } from './group-form-dialog';
import { quietContext } from '@core/http/api-error.interceptor';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { HelpButton } from '@features/help/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { Busy } from '@shared/ui/busy';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';

/** Teacher: groups of students taught together, their members and lesson prices (under the students). */
@Component({
  selector: 'tb-groups-panel',
  imports: [
    EmptyState,
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    Menu,
    Tag,
    ToggleSwitch,
    Tooltip,
    ButtonAttributes,
    GroupFormDialog,
    HelpButton,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >{{ t.title }} <tb-help-button topic="teacher/groups"
          /></span>
          <div class="tb-card-title__actions">
            <p-button
              [label]="t.create"
              severity="secondary"
              icon="tb-i tb-i-group"
              (onClick)="openCreate()"
            />
          </div>
        </div>
      </ng-template>
      <div class="tb-toolbar">
        <label class="tb-switch" for="show-archived">
          <p-toggleswitch inputId="show-archived" [formControl]="showArchived" />
          {{ t.showArchived }}
        </label>
      </div>

      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (visibleGroups().length > 0) {
          <ul class="tb-list" [attr.aria-label]="t.title">
            @for (group of visibleGroups(); track group.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i tb-i-group"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ group.name }}</span>
                  <span class="tb-list__supporting">
                    @if (group.members.length === 0) {
                      {{ t.nobody }}
                    } @else {
                      {{ memberNames(group) }}
                    }
                  </span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  @if (group.archivedAt) {
                    <p-tag [value]="t.archived" severity="secondary" />
                  }
                  <p-button
                    icon="tb-i tb-i-more_vert"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="t.actions(group.name)"
                    [ariaLabel]="t.actions(group.name)"
                    [loading]="busy.is('restore-' + group.id)"
                    [tbAttributes]="{
                      'aria-haspopup': 'menu',
                      'aria-expanded': menuFor()?.id === group.id ? 'true' : 'false',
                    }"
                    (onClick)="openMenu(group, $event)"
                  />
                </div>
              </li>
            }
          </ul>
        } @else if (groups().length === 0) {
          <tb-empty-state icon="tb-i-group" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        } @else {
          <tb-empty-state
            icon="tb-i-inventory_2"
            [title]="t.allArchivedTitle"
            [hint]="t.allArchivedHint"
          />
        }
      </tb-load-state>
    </p-card>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
    <tb-group-form-dialog
      [(visible)]="formVisible"
      [group]="edited()"
      [students]="students()"
      [lessonPrice]="editedPrice()"
      [currency]="currency()"
      (saved)="onSaved($event)"
    />
    <p-confirmdialog key="groups" />
  `,
})
export class GroupsPanel implements OnInit {
  protected readonly t = T.groups;
  private readonly snackbar = inject(Snackbar);
  protected readonly busy = new Busy();
  private readonly api = inject(IdentityApi);
  private readonly billing = inject(BillingApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly menu = viewChild.required<Menu>('menu');

  /** Students of the teacher: the members to choose from. */
  readonly students = input<readonly Student[]>([]);

  protected readonly groups = signal<StudentGroup[]>([]);
  private readonly prices = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly currency = signal('RUB');
  protected readonly state = new LoadState();
  protected readonly showArchived = new FormControl(false, { nonNullable: true });
  private readonly includeArchived = toSignal(this.showArchived.valueChanges, {
    initialValue: false,
  });
  protected readonly visibleGroups = computed(() =>
    this.groups().filter((group) => this.includeArchived() || group.archivedAt === null),
  );

  /** The group whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<StudentGroup | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const group = this.menuFor();
    return group === null ? [] : this.actionsOf(group);
  });

  protected readonly formVisible = signal(false);
  protected readonly edited = signal<StudentGroup | null>(null);
  protected readonly editedPrice = computed(() => {
    const group = this.edited();
    return group === null ? null : this.priceOf(group.id);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    forkJoin({
      groups: this.api.listGroups(quietContext()),
      prices: this.billing.groupPrices(quietContext()),
    })
      .pipe(this.state.track())
      .subscribe(({ groups, prices }) => {
        this.groups.set(groups);
        this.currency.set(prices.currency);
        this.prices.set(new Map(prices.prices.map((price) => [price.groupId, price.lessonPrice])));
      });
  }

  protected memberNames(group: StudentGroup): string {
    return group.members.map((member) => member.displayName).join(', ');
  }

  protected openMenu(group: StudentGroup, event: Event): void {
    this.menuFor.set(group);
    this.menu().toggle(event);
  }

  protected openCreate(): void {
    this.edited.set(null);
    this.formVisible.set(true);
  }

  protected openEdit(group: StudentGroup): void {
    this.edited.set(group);
    this.formVisible.set(true);
  }

  protected onSaved({ group, lessonPrice }: SavedGroup): void {
    this.snackbar.success(T.groups.saved);
    this.replace(group);
    if (lessonPrice !== null) {
      this.prices.update((prices) => new Map(prices).set(group.id, lessonPrice));
    }
  }

  protected confirmArchive(group: StudentGroup): void {
    this.confirmation.confirm(
      dangerConfirmation({
        key: 'groups',
        header: T.groups.archiveHeader,
        message: T.groups.archiveMessage(group.name),
        icon: 'tb-i tb-i-warning',
        acceptLabel: T.groups.archive,
        accept: () => {
          this.api.archiveGroup(group.id).subscribe((saved) => {
            this.replace(saved);
          });
        },
      }),
    );
  }

  protected restore(group: StudentGroup): void {
    this.busy.guard('restore-' + group.id, this.api.restoreGroup(group.id)).subscribe((saved) => {
      this.replace(saved);
    });
  }

  private priceOf(groupId: string): number | null {
    return this.prices().get(groupId) ?? null;
  }

  private actionsOf(group: StudentGroup): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: T.groups.edit,
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.openEdit(group);
        },
      },
    ];
    if (group.archivedAt === null) {
      items.push({
        label: T.groups.archiveItem,
        icon: 'tb-i tb-i-inbox',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.confirmArchive(group);
        },
      });
    } else {
      items.push({
        label: T.groups.restore,
        icon: 'tb-i tb-i-replay',
        command: () => {
          this.restore(group);
        },
      });
    }
    return items;
  }

  private replace(saved: StudentGroup): void {
    this.groups.update((groups) =>
      sortGroups([...groups.filter((group) => group.id !== saved.id), saved]),
    );
  }
}

/** Current groups first, then by name. */
function sortGroups(groups: StudentGroup[]): StudentGroup[] {
  return groups.sort(
    (a, b) =>
      Number(a.archivedAt !== null) - Number(b.archivedAt !== null) ||
      a.name.localeCompare(b.name, 'ru'),
  );
}
