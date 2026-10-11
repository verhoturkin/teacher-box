import { Injectable } from '@angular/core';
import { HelpArticle, HelpArticleText } from './help.models';
import { HELP_TOPICS, HelpArea } from './help-topics';
import { Language, language, locale } from '@core/i18n/language';

type Articles = () => Promise<Readonly<Record<string, HelpArticleText>>>;

/** The articles of each language (ADR-0035): a chunk per language and area, loaded when the help opens. */
const ARTICLES: Readonly<Record<Language, Readonly<Record<HelpArea, Articles>>>> = {
  ru: {
    teacher: async () => (await import('./articles/teacher.ru')).TEACHER_ARTICLES,
    cabinet: async () => (await import('./articles/student.ru')).STUDENT_ARTICLES,
    admin: async () => (await import('./articles/admin.ru')).ADMIN_ARTICLES,
  },
  en: {
    teacher: async () => (await import('./articles/teacher.en')).TEACHER_ARTICLES,
    cabinet: async () => (await import('./articles/student.en')).STUDENT_ARTICLES,
    admin: async () => (await import('./articles/admin.en')).ADMIN_ARTICLES,
  },
};

/** The articles of an area in the current language; their texts are loaded only when the help is opened. */
@Injectable({ providedIn: 'root' })
export class HelpLibrary {
  async articles(area: HelpArea): Promise<HelpArticle[]> {
    const texts = await this.texts(area);
    return HELP_TOPICS[area].flatMap((id) => {
      const text = texts[id];
      return text === undefined ? [] : [{ id, ...text }];
    });
  }

  /** The article of a topic like `teacher/schedule`; `null` for an unknown one. */
  async article(topic: string): Promise<HelpArticle | null> {
    const [area, id] = topic.split('/');
    if (area !== 'teacher' && area !== 'cabinet' && area !== 'admin') {
      return null;
    }
    return (await this.articles(area)).find((article) => article.id === id) ?? null;
  }

  private texts(area: HelpArea): Promise<Readonly<Record<string, HelpArticleText>>> {
    return ARTICLES[language()][area]();
  }
}

/**
 * The text for searching: lower case, «ё» as «е» (most people write without it), the marks of the
 * Markdown (links, bold, headings) removed, so that the search does not find the addresses.
 */
export function searchable(text: string): string {
  return text
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/[*#`[\]_>]/g, ' ')
    .toLocaleLowerCase(locale())
    .replaceAll('ё', 'е');
}

/** Articles whose title, summary or text contains every word of the query («ё» and «е» are the same). */
export function searchArticles(articles: readonly HelpArticle[], query: string): HelpArticle[] {
  const words = searchable(query)
    .split(/\s+/)
    .filter((word) => word !== '');
  if (words.length === 0) {
    return [...articles];
  }
  return articles.filter((article) => {
    const text = searchable(`${article.title} ${article.summary} ${article.body}`);
    return words.every((word) => text.includes(word));
  });
}
