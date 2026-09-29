import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { HelpArticleView } from './help-article-view';
import { HelpLibrary, searchArticles } from './help-library';
import { HelpArticle } from './help.models';
import { HelpArea } from './help-topics';
import { PageHeader } from '@shared/ui/page-header';

/**
 * The help of an area (`/<area>/help/<topic>`): the contents with search on top, the chosen article
 * under them.
 */
@Component({
  selector: 'tb-help-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Card,
    IconField,
    InputIcon,
    InputText,
    HelpArticleView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Справка" />
    <div class="tb-stack">
      <p-card styleClass="tb-help__contents">
        <p-iconfield>
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            [formControl]="search"
            placeholder="Поиск по справке"
            aria-label="Поиск по справке"
          />
        </p-iconfield>
        <nav aria-label="Статьи справки">
          <ul class="tb-help__list">
            @for (article of found(); track article.id) {
              <li>
                <a
                  class="tb-help__chip"
                  [routerLink]="['/', area(), 'help', article.id]"
                  [class.tb-help__current]="article.id === current()?.id"
                  [attr.aria-current]="article.id === current()?.id ? 'page' : null"
                  [attr.title]="article.summary"
                  >{{ article.title }}</a
                >
              </li>
            } @empty {
              @if (loaded()) {
                <li class="tb-muted">Ничего не нашлось. Попробуйте другие слова.</li>
              }
            }
          </ul>
        </nav>
      </p-card>
      <p-card class="tb-help__article-card" styleClass="tb-help__article">
        @if (current(); as article) {
          @if (missing()) {
            <p class="tb-muted">Такой статьи нет — вот «{{ article.title }}».</p>
          }
          <h2 class="tb-help__title">{{ article.title }}</h2>
          <p class="tb-help__summary">{{ article.summary }}</p>
          <tb-help-article [body]="article.body" />
        }
      </p-card>
    </div>
  `,
  styles: `
    /*
     * The contents on top (ADR-0021): the search and the titles of the articles as chips in a few
     * lines, the summary of an article in its tooltip; the chosen article right under them.
     */
    .tb-help__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      margin: var(--tb-space-4) 0 0;
      padding: 0;
      list-style: none;
    }

    .tb-help__chip {
      display: inline-flex;
      align-items: center;
      min-height: 2rem;
      box-sizing: border-box;
      padding: var(--tb-space-1) var(--tb-space-3);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
        text-decoration: none;
      }
    }

    .tb-help__current,
    .tb-help__current:hover {
      border-color: var(--p-md-secondary-container);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-help__title {
      margin: 0;
      font: var(--tb-type-headline-s);
    }

    .tb-help__summary {
      margin: var(--tb-space-1) 0 var(--tb-space-4);
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class HelpPage {
  private readonly library = inject(HelpLibrary);

  /** Route data: whose help. */
  readonly area = input.required<HelpArea>();
  /** Route parameter: the article. */
  readonly topic = input<string>();

  protected readonly articles = signal<HelpArticle[]>([]);
  protected readonly loaded = signal(false);
  readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly found = computed(() => searchArticles(this.articles(), this.query()));
  protected readonly current = computed(() => {
    const topic = this.topic();
    const all = this.articles();
    return all.find((article) => article.id === topic) ?? all[0] ?? null;
  });
  protected readonly missing = computed(() => {
    const topic = this.topic();
    return (
      this.loaded() &&
      topic !== undefined &&
      this.articles().every((article) => article.id !== topic)
    );
  });

  constructor() {
    effect(() => {
      const area = this.area();
      void this.library.articles(area).then((articles) => {
        this.articles.set(articles);
        this.loaded.set(true);
      });
    });
  }
}
