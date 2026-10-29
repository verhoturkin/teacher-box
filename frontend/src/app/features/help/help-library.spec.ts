import { TestBed } from '@angular/core/testing';
import { en } from './i18n/en';
import { ADMIN_ARTICLES as ADMIN_EN } from './articles/admin.en';
import { STUDENT_ARTICLES as STUDENT_EN } from './articles/student.en';
import { TEACHER_ARTICLES as TEACHER_EN } from './articles/teacher.en';
import { ADMIN_ARTICLES } from './articles/admin.ru';
import { STUDENT_ARTICLES } from './articles/student.ru';
import { TEACHER_ARTICLES } from './articles/teacher.ru';
import { HelpLibrary, searchArticles, searchable } from './help-library';
import { HelpArticleText } from './help.models';
import { HELP_TITLES, HELP_TOPICS, HelpArea, helpUrl, isHelpArea } from './help-topics';

const TEXTS: Record<HelpArea, Readonly<Record<string, HelpArticleText>>> = {
  teacher: TEACHER_ARTICLES,
  cabinet: STUDENT_ARTICLES,
  admin: ADMIN_ARTICLES,
};

const ENGLISH_TEXTS: Record<HelpArea, Readonly<Record<string, HelpArticleText>>> = {
  teacher: TEACHER_EN,
  cabinet: STUDENT_EN,
  admin: ADMIN_EN,
};

describe('HelpLibrary', () => {
  let library: HelpLibrary;

  beforeEach(() => {
    library = TestBed.inject(HelpLibrary);
  });

  it('has an article for every topic of every area, in the order of the contents', async () => {
    for (const area of ['teacher', 'cabinet', 'admin'] as const) {
      const articles = await library.articles(area);
      expect(articles.map((article) => article.id)).toEqual([...HELP_TOPICS[area]]);
      for (const article of articles) {
        expect(article.title).not.toBe('');
        expect(article.summary).not.toBe('');
        expect(article.body.trim().length).toBeGreaterThan(100);
      }
    }
    expect(Object.keys(TEXTS.teacher).sort()).toEqual([...HELP_TOPICS.teacher].sort());
  });

  it('names the help buttons by the titles of the articles', () => {
    expect(Object.keys(HELP_TITLES)).toHaveLength(
      Object.values(HELP_TOPICS).reduce((count, topics) => count + topics.length, 0),
    );
    for (const [topic, title] of Object.entries(HELP_TITLES)) {
      const [area, id] = topic.split('/');
      expect(isHelpArea(area) ? TEXTS[area][id ?? '']?.title : undefined, topic).toBe(title);
    }
  });

  it('keeps English help topics and titles aligned with navigation', () => {
    for (const area of ['teacher', 'cabinet', 'admin'] as const) {
      expect(Object.keys(ENGLISH_TEXTS[area]).sort()).toEqual([...HELP_TOPICS[area]].sort());
      for (const topic of HELP_TOPICS[area]) {
        const article = ENGLISH_TEXTS[area][topic];
        expect(article?.title).toBe(Reflect.get(en.titles, `${area}/${topic}`));
        expect(article?.summary.trim().length).toBeGreaterThan(0);
        expect(article?.body.trim().length).toBeGreaterThan(100);
      }
    }
  });

  it('links inside Russian and English articles lead to existing articles', () => {
    const links: string[] = [];
    for (const texts of [...Object.values(TEXTS), ...Object.values(ENGLISH_TEXTS)]) {
      for (const text of Object.values(texts)) {
        for (const match of text.body.matchAll(/\]\((\/[^)]*)\)/g)) {
          links.push(match[1] ?? '');
        }
      }
    }
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      const [, area, help, topic] = link.split('/');
      expect(isHelpArea(area), link).toBe(true);
      expect(help, link).toBe('help');
      expect(isHelpArea(area) && HELP_TOPICS[area].includes(topic ?? ''), link).toBe(true);
    }
  });

  it('finds an article by its topic', async () => {
    expect((await library.article('teacher/groups'))?.title).toBe('Группы');
    expect((await library.article('cabinet/bot'))?.title).toBe('Бот в мессенджере');
    expect((await library.article('admin/diagnostics'))?.id).toBe('diagnostics');
    expect(await library.article('teacher/missing')).toBeNull();
    expect(await library.article('other/faq')).toBeNull();
    expect(helpUrl('teacher/schedule')).toBe('/teacher/help/schedule');
  });

  it('searches every word in titles and texts', async () => {
    const articles = await library.articles('teacher');

    expect(searchArticles(articles, '  ')).toHaveLength(articles.length);
    expect(searchArticles(articles, 'ТЕЛЕМОСТ').map((article) => article.id)).toContain('meetings');
    expect(searchArticles(articles, 'группа цена').map((article) => article.id)).toContain(
      'groups',
    );
    expect(searchArticles(articles, 'абракадабра')).toEqual([]);
  });

  it('does not tell «е» from «ё» and does not search the addresses of the links', async () => {
    const articles = await library.articles('teacher');

    // the article «Оформление и телефон» has «Тёмная тема» and «цвет»; people write «темная»
    expect(searchArticles(articles, 'темная тема').map((article) => article.id)).toContain(
      'appearance',
    );
    expect(searchArticles(articles, 'тёмная тема').map((article) => article.id)).toContain(
      'appearance',
    );
    expect(
      searchable('[Видеовстречи](/teacher/help/meetings) **Ёлка**').split(/\s+/).filter(Boolean),
    ).toEqual(['видеовстречи', 'елка']);
    // an address of a link is not text: «help» is in every address and in no word
    expect(searchArticles(articles, 'teacher/help')).toEqual([]);
  });
});
