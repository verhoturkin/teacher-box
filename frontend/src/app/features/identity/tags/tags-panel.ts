import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { Snackbar } from '@core/snackbar/snackbar';
import { AssistChip } from '@shared/ui/assist-chip';
import { Busy } from '@shared/ui/busy';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { IdentityApi } from '../data-access/identity-api';
import { StudentTag, TagChanged } from '../data-access/identity.models';
import { T } from '../i18n/texts';
import { TagDialog } from './tag-dialog';

/** The values a tile lists before «ещё N». */
const SHOWN_VALUES = 6;

/** A tag of the templates on the empty state: its icon and the labels of its values. */
interface Template {
  readonly icon: string;
  readonly name: string;
  readonly chip: string;
  readonly values: readonly string[];
}

const t = T.tags;
const TEMPLATES: readonly Template[] = [
  {
    icon: 'translate',
    name: t.cefr.name,
    chip: t.cefr.chip,
    values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    icon: 'school',
    name: t.grade.name,
    chip: t.grade.chip,
    values: Array.from({ length: 11 }, (_, index) => String(index + 1)),
  },
  { icon: 'flag', name: t.goal.name, chip: t.goal.chip, values: t.goal.values },
];

/**
 * Settings → «Ученики» → «Теги учеников» (sketch Tags, ADR-0055): the teacher's tags with their values and
 * the AI mark, reordered by dragging; a tag opens in the dialog. Without tags the card offers templates.
 */
@Component({
  selector: 'tb-tags-panel',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Button,
    Card,
    Tag,
    Tooltip,
    AssistChip,
    EmptyState,
    LoadStateView,
    TagDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title" styleClass="tb-section-card tb-section-card--flow">
      <p class="tb-tags__intro">{{ t.intro }}</p>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (tags().length > 0) {
          <ul
            class="tb-tiles tb-tags__list"
            cdkDropList
            [attr.aria-label]="t.title"
            (cdkDropListDropped)="drop($event)"
          >
            @for (tag of tags(); track tag.id) {
              <li class="tb-tile" cdkDrag>
                <button
                  type="button"
                  class="tb-drag-handle"
                  cdkDragHandle
                  [attr.aria-label]="t.drag(tag.name)"
                  (keydown)="keyMove($event, tag)"
                >
                  <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
                </button>
                <i class="tb-i tb-i-sell tb-tile__icon" aria-hidden="true"></i>
                <span class="tb-tile__text">
                  <b>{{ tag.name }}</b>
                  <span class="tb-tags__values">
                    @for (value of tag.values.slice(0, shown); track value.id) {
                      <p-tag severity="secondary" [value]="value.label" />
                    }
                    @if (tag.values.length > shown) {
                      <span>{{ t.more(tag.values.length - shown) }}</span>
                    }
                  </span>
                </span>
                @if (tag.useInAi) {
                  <p-tag styleClass="tb-tags__ai" [value]="t.ai" [pTooltip]="t.aiHint" />
                }
                <p-button
                  icon="tb-i tb-i-edit"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="t.edit(tag.name)"
                  (onClick)="edit(tag)"
                />
              </li>
            }
          </ul>
          <div class="tb-tags__actions">
            <p-button
              icon="tb-i tb-i-add"
              severity="secondary"
              [label]="t.add"
              (onClick)="edit(null)"
            />
          </div>
        } @else {
          <tb-empty-state icon="tb-i-sell" [title]="t.emptyTitle" [hint]="t.emptyHint">
            <div class="tb-tags__templates">
              @for (template of templates; track template.name) {
                <tb-assist-chip
                  [icon]="template.icon"
                  [disabled]="busy.any()"
                  (click)="fromTemplate(template)"
                  >{{ template.chip }}</tb-assist-chip
                >
              }
              <tb-assist-chip icon="add" [dashed]="true" (click)="edit(null)">{{
                t.custom
              }}</tb-assist-chip>
            </div>
          </tb-empty-state>
        }
      </tb-load-state>
    </p-card>
    <tb-tag-dialog
      [(visible)]="dialog"
      [tag]="editing()"
      (saved)="saved($event)"
      (deleted)="deleted($event)"
    />
  `,
  styles: `
    .tb-tags__intro {
      margin: 0 0 var(--tb-space-3);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-tags__list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-tags__values {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-1);
      margin-block-start: var(--tb-space-1);
    }

    :host ::ng-deep .tb-tags__ai {
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
    }

    .tb-tags__actions {
      display: flex;
      margin-block-start: var(--tb-space-3);
    }

    .tb-tags__templates {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class TagsPanel implements OnInit {
  protected readonly t = t;
  protected readonly shown = SHOWN_VALUES;
  protected readonly templates = TEMPLATES;
  private readonly api = inject(IdentityApi);
  private readonly snackbar = inject(Snackbar);
  protected readonly busy = new Busy();
  protected readonly state = new LoadState();

  protected readonly tags = signal<readonly StudentTag[]>([]);
  protected readonly dialog = signal(false);
  protected readonly editing = signal<StudentTag | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .listTags(quietContext())
      .pipe(this.state.track())
      .subscribe((list) => {
        this.tags.set(list);
      });
  }

  protected edit(tag: StudentTag | null): void {
    this.editing.set(tag);
    this.dialog.set(true);
  }

  protected fromTemplate(template: Template): void {
    this.busy
      .guard('template', this.api.createTag(template.name, true, template.values))
      .subscribe((tag) => {
        this.tags.update((list) => [...list, tag]);
        this.snackbar.success(t.createdFromTemplate(tag.name));
      });
  }

  protected saved({ tag, clearedStudents }: TagChanged): void {
    this.tags.update((list) =>
      list.some((entry) => entry.id === tag.id)
        ? list.map((entry) => (entry.id === tag.id ? tag : entry))
        : [...list, tag],
    );
    this.snackbar.success(
      clearedStudents > 0 ? t.savedCleared(tag.name, clearedStudents) : t.saved(tag.name),
    );
  }

  protected deleted({ tag, clearedStudents }: TagChanged): void {
    this.tags.update((list) => list.filter((entry) => entry.id !== tag.id));
    this.snackbar.success(
      clearedStudents > 0 ? t.deletedCleared(tag.name, clearedStudents) : t.deleted(tag.name),
    );
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** The arrow keys on a handle move the tag; the focus stays on its handle. */
  protected keyMove(event: KeyboardEvent, tag: StudentTag): void {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step !== 0) {
      event.preventDefault();
      const from = this.tags().findIndex((entry) => entry.id === tag.id);
      this.move(from, from + step);
    }
  }

  private move(from: number, to: number): void {
    const list = [...this.tags()];
    if (from === to || to < 0 || to >= list.length) {
      return;
    }
    const [moved] = list.splice(from, 1);
    if (moved === undefined) {
      return;
    }
    list.splice(to, 0, moved);
    const before = this.tags();
    this.tags.set(list);
    this.api.reorderTags(list.map((tag) => tag.id)).subscribe({
      error: () => {
        this.tags.set(before);
      },
    });
  }
}
