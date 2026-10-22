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
import { pageDetail } from '@core/routing/page-detail';
import { HelpArticleView } from './help-article-view';
import { HelpLibrary, searchArticles } from './help-library';
import { HelpArticle } from './help.models';
import { HelpArea } from './help-topics';
import { PageHeader } from '@shared/ui/page-header';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from './i18n/texts';
import { SearchField } from '@shared/ui/search-field';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';

/**
 * The help of an area (`/<area>/help/<topic>`): list-detail — the contents with search in a fixed pane,
 * the chosen article beside it; on compact and medium `/<area>/help` is the contents and an article has
 * «back» to it.
 */
@Component({
  selector: 'tb-help-page',
  imports: [
    SearchField,
    EmptyState,
    ReactiveFormsModule,
    RouterLink,
    Panes,
    Pane,
    HelpArticleView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.articles">
          <div tbPaneHeader>
            <tb-page-header [title]="t.help" />
            <tb-search-field [formControl]="search" [label]="t.search" />
          </div>
          <nav [attr.aria-label]="t.articles">
            <ul class="tb-help__list">
              @for (article of found(); track article.id) {
                <li>
                  <a
                    class="tb-help__item"
                    [routerLink]="['/', area(), 'help', article.id]"
                    [class.tb-help__current]="isCurrent(article)"
                    [attr.aria-current]="isCurrent(article) ? 'page' : null"
                  >
                    <span class="tb-help__item-title">{{ article.title }}</span>
                    <span class="tb-help__item-summary">{{ article.summary }}</span>
                  </a>
                </li>
              } @empty {
                @if (loaded()) {
                  <li>
                    <tb-empty-state
                      [compact]="true"
                      icon="tb-i-search"
                      [title]="t.notFoundTitle"
                      [hint]="t.notFoundHint"
                    />
                  </li>
                }
              }
            </ul>
          </nav>
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane class="tb-help__article-card">
          @if (layout.single()) {
            <tb-page-header
              tbPaneHeader
              [title]="t.help"
              [back]="['/', area(), 'help']"
              [backLabel]="t.all"
            />
          }
          <div tbPaneHeader>
            @if (current(); as article) {
              <h2 class="tb-help__title">{{ article.title }}</h2>
              <p class="tb-help__summary">{{ article.summary }}</p>
            }
          </div>
          @if (current(); as article) {
            <article class="tb-help__article">
              @if (missing()) {
                <p class="tb-muted">{{ t.missing(article.title) }}</p>
              }

              <tb-help-article [body]="article.body" />
            </article>
          }
        </tb-pane>
      }
    </tb-panes>
  `,
  styles: `
    /*
     * List-detail (redesign spec §3.3): the contents with the search in the fixed pane, the chosen
     * article in the flexible one; on compact and medium the route shows one of them. Running text uses
     * the available pane width.
     */
    .tb-help__list {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      margin: var(--tb-space-4) 0 0;
      padding: 0;
      list-style: none;
    }

    .tb-help__item {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      color: var(--p-md-on-surface);

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
        text-decoration: none;
      }
    }

    .tb-help__item-title {
      font: var(--tb-type-title-m);
    }

    .tb-help__item-summary {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-help__current,
    .tb-help__current:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-help__item-title {
        font: var(--tb-type-title-m-emphasized);
      }

      .tb-help__item-summary {
        color: inherit;
      }
    }

    .tb-help__article {
      width: 100%;
    }

    .tb-help__title {
      margin: 0;
      font: var(--tb-type-headline-s-emphasized);
    }

    .tb-help__summary {
      margin: var(--tb-space-1) 0 var(--tb-space-4);
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class HelpPage {
  protected readonly t = T;
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
  /** The article of the address (or the first one) is open; on one pane only an address opens it. */
  protected readonly layout = injectListDetail(() => this.topic() !== undefined);
  protected readonly missing = computed(() => {
    const topic = this.topic();
    return (
      this.loaded() &&
      topic !== undefined &&
      this.articles().every((article) => article.id !== topic)
    );
  });

  protected isCurrent(article: HelpArticle): boolean {
    return this.layout.detail() && article.id === this.current()?.id;
  }

  constructor() {
    pageDetail(() => (this.layout.detail() ? this.current()?.title : null));
    effect(() => {
      const area = this.area();
      void this.library.articles(area).then((articles) => {
        this.articles.set(articles);
        this.loaded.set(true);
      });
    });
  }
}
