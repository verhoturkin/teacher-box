import { expectComplete } from '@testing/i18n';
import { ADMIN_ARTICLES } from '../articles/admin.en';
import { STUDENT_ARTICLES } from '../articles/student.en';
import { TEACHER_ARTICLES } from '../articles/teacher.en';
import { HELP_TOPICS, isHelpArea } from '../help-topics';
import { HelpArticleText } from '../help.models';
import { en } from './en';
import { ru } from './ru';

const ENGLISH: Readonly<Record<string, Readonly<Record<string, HelpArticleText>>>> = {
  teacher: TEACHER_ARTICLES,
  cabinet: STUDENT_ARTICLES,
  admin: ADMIN_ARTICLES,
};

describe('texts of the help', () => {
  it('are complete in every language', () => {
    expectComplete(ru, en);
  });

  it('has every English article, titled as its help button names it', () => {
    for (const [area, topics] of Object.entries(HELP_TOPICS)) {
      expect(Object.keys(ENGLISH[area] ?? {}).sort(), area).toEqual([...topics].sort());
    }
    for (const [topic, title] of Object.entries(en.titles)) {
      const [area, id] = topic.split('/');
      expect(ENGLISH[area ?? '']?.[id ?? '']?.title, topic).toBe(title);
    }
  });

  it('links the English articles to existing articles', () => {
    const links = Object.values(ENGLISH).flatMap((texts) =>
      Object.values(texts).flatMap((text) =>
        [...text.body.matchAll(/\]\((\/[^)]*)\)/g)].map((match) => match[1] ?? ''),
      ),
    );
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      const [, area, help, topic] = link.split('/');
      expect(help, link).toBe('help');
      expect(isHelpArea(area) && HELP_TOPICS[area].includes(topic ?? ''), link).toBe(true);
    }
  });
});
