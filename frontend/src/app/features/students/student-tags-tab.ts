import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { quietContext } from '@core/http/api-error.interceptor';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { IdentityApi, Student, StudentTag } from '@features/identity/parts';
import { T } from './i18n/texts';

/** Where «Настроить теги» and «Создать теги» lead. */
export const TAGS_SETTINGS = '/teacher/settings/students';

/**
 * The Теги tab of a student's card (sketch Main, ADR-0055): one M3 list row per tag — the lead icon on
 * tertiary container when the AI takes the tag, on secondary container when it does not — with an outlined
 * select of the values («Не задан» first), saved on choosing, or a filled text field for a text tag, saved on
 * blur and Enter; beside the rows «Что увидит ИИ». The tab is
 * always there: without tags it tells what they are for and leads to the settings.
 */
@Component({
  selector: 'tb-student-tags-tab',
  imports: [
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    EmptyState,
    FormsModule,
    InputText,
    LoadStateView,
    RouterLink,
    Select,
    Tag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (tags().length === 0) {
        <tb-empty-state icon="tb-i-sell" [title]="t.emptyTitle" [hint]="t.emptyHint">
          <a pButton severity="secondary" [routerLink]="settings">
            <i pButtonIcon class="tb-i tb-i-add" aria-hidden="true"></i>
            <span pButtonLabel>{{ t.create }}</span>
          </a>
        </tb-empty-state>
      } @else {
        <div class="tb-student-tags">
          <p-card class="tb-student-tags__card">
            <ng-template #title>
              <span class="tb-student-tags__title"
                ><span>{{ t.title }}</span>
                <span class="tb-student-tags__note"
                  ><i class="tb-i tb-i-visibility_off" aria-hidden="true"></i>{{ t.private }}</span
                ></span
              >
            </ng-template>
            <ul class="tb-tiles tb-student-tags__list" [attr.aria-label]="t.title">
              @for (tag of tags(); track tag.id) {
                <li class="tb-tile">
                  <i
                    class="tb-i tb-tile__icon"
                    [class.tb-i-auto_awesome]="tag.useInAi"
                    [class.tb-i-sell]="!tag.useInAi"
                    [class.tb-student-tags__ai]="tag.useInAi"
                    aria-hidden="true"
                  ></i>
                  <span class="tb-tile__text">
                    <b>{{ tag.name }}</b>
                    <span>{{
                      tag.useInAi ? t.forAi : tag.kind === 'TEXT' ? t.forYou : t.forFilter
                    }}</span>
                  </span>
                  @if (tag.kind === 'TEXT') {
                    <div class="tb-field tb-student-tags__text">
                      <label [for]="'tag-text-' + tag.id">{{ t.text }}</label>
                      <input
                        pInputText
                        #field
                        [id]="'tag-text-' + tag.id"
                        maxlength="120"
                        autocomplete="off"
                        [value]="values()[tag.id] ?? ''"
                        (blur)="write(tag, field)"
                        (keydown.enter)="field.blur()"
                      />
                    </div>
                  } @else {
                    <p-select
                      class="tb-student-tags__select"
                      [ariaLabel]="tag.name"
                      [options]="optionsOf(tag)"
                      optionLabel="label"
                      optionValue="id"
                      appendTo="body"
                      [ngModel]="values()[tag.id] ?? null"
                      (ngModelChange)="choose(tag, $event)"
                    />
                  }
                </li>
              }
            </ul>
            <div class="tb-student-tags__foot">
              <span class="tb-student-tags__note"
                ><i class="tb-i tb-i-cloud_done" aria-hidden="true"></i>{{ t.autosave }}</span
              >
              <a pButton [text]="true" [routerLink]="settings">
                <i pButtonIcon class="tb-i tb-i-settings" aria-hidden="true"></i>
                <span pButtonLabel>{{ t.settings }}</span>
              </a>
            </div>
          </p-card>

          <p-card class="tb-student-tags__ai-card">
            <ng-template #title>
              <span class="tb-student-tags__title"
                ><i class="tb-i tb-i-auto_awesome" aria-hidden="true"></i>{{ t.aiTitle }}</span
              >
            </ng-template>
            @if (seen().length > 0) {
              <p class="tb-student-tags__text">{{ t.aiIntro }}</p>
              <div class="tb-student-tags__seen">
                @for (pair of seen(); track pair) {
                  <p-tag styleClass="tb-student-tags__chip" [value]="pair" />
                }
              </div>
              <p class="tb-student-tags__hint">{{ t.aiHint }}</p>
            } @else {
              <p class="tb-student-tags__text">{{ t.aiEmpty }}</p>
            }
          </p-card>
        </div>
      }
    </tb-load-state>
  `,
  styles: `
    .tb-student-tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-4);
      align-items: flex-start;
    }

    .tb-student-tags__card {
      flex: 999 1 28rem;
      min-inline-size: 0;
    }

    .tb-student-tags__ai-card {
      flex: 1 1 18rem;
      max-inline-size: 22rem;
    }

    .tb-student-tags__title {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-student-tags__title > :first-child:not(.tb-i) {
      flex: 1;
    }

    .tb-student-tags__note {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);

      > .tb-i {
        font-size: 1rem;
      }
    }

    .tb-student-tags__list {
      margin: 0 0 var(--tb-space-3);
      padding: 0;
      list-style: none;
    }

    /* tertiary container: the colour of the AI everywhere (sketch TagElements) */
    .tb-student-tags__ai {
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
    }

    .tb-student-tags__select {
      flex: none;
      inline-size: 10.5rem;
    }

    /* a free text needs more room than a value (ours) */
    .tb-student-tags__text {
      flex: 0 1 16rem;
      min-inline-size: 0;
    }

    .tb-student-tags__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
    }

    .tb-student-tags__text,
    .tb-student-tags__hint {
      margin: 0 0 var(--tb-space-3);
      font: var(--tb-type-body-m);
    }

    .tb-student-tags__hint {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-student-tags__seen {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-1);
      margin-block-end: var(--tb-space-3);
    }

    :host ::ng-deep .tb-student-tags__chip {
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
    }

    /* a phone: the select takes its own line under the name (the sketch PhoneTags keeps it at the end; ours) */
    @media (width < 600px) {
      .tb-student-tags__select {
        inline-size: 8rem;
      }
    }
  `,
})
export class StudentTagsTab implements OnInit {
  protected readonly t = T.studentTags;
  protected readonly settings = TAGS_SETTINGS;
  private readonly api = inject(IdentityApi);

  readonly student = input.required<Student>();
  /** The tags changed: the student as the server keeps them now. */
  readonly saved = output<Student>();

  protected readonly state = new LoadState();
  protected readonly tags = signal<readonly StudentTag[]>([]);
  /** What the rows show: the saved values and texts, a choice just made until the server answers. */
  protected readonly values = signal<Readonly<Record<string, string>>>({});

  /** «Уровень английского: B1» for the tags the AI takes and the student has. */
  protected readonly seen = computed(() =>
    this.tags().flatMap((tag) => {
      const set = this.values()[tag.id];
      const value = tag.kind === 'TEXT' ? set : tag.values.find((item) => item.id === set)?.label;
      return tag.useInAi && value !== undefined ? [this.t.pair(tag.name, value)] : [];
    }),
  );

  ngOnInit(): void {
    this.values.set(this.student().tags);
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

  protected optionsOf(tag: StudentTag): { id: string | null; label: string }[] {
    return [{ id: null, label: this.t.none }, ...tag.values];
  }

  /** Saves the text of a text tag once it changed; a blank one clears the tag. */
  protected write(tag: StudentTag, field: HTMLInputElement): void {
    const text = field.value.trim();
    field.value = text;
    if (text !== (this.values()[tag.id] ?? '')) {
      this.choose(tag, text === '' ? null : text);
    }
  }

  /** `valueId` — the value of a list tag or the text of a text tag; `null` clears the tag. */
  choose(tag: StudentTag, valueId: string | null): void {
    const before = this.values();
    const next = Object.fromEntries(Object.entries(before).filter(([id]) => id !== tag.id));
    if (valueId !== null) {
      next[tag.id] = valueId;
    }
    this.values.set(next);
    this.api.setStudentTags(this.student().id, next).subscribe({
      next: (student) => {
        this.saved.emit(student);
      },
      error: () => {
        this.values.set(before);
      },
    });
  }
}
