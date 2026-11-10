import { HelpArticleText } from '@features/help/help.models';
import { StudentTopic } from '@features/help/help-topics';
import { loginArticle } from './login';
import { scheduleArticle } from './schedule';
import { lessonArticle } from './lesson';
import { homeworkArticle } from './homework';
import { textbooksArticle } from './textbooks';
import { billingArticle } from './billing';
import { botArticle } from './bot';
import { appearanceArticle } from './appearance';

/** English help, written for students alongside the Russian edition. */
export const STUDENT_ARTICLES: Readonly<Record<StudentTopic, HelpArticleText>> = {
  login: loginArticle,
  schedule: scheduleArticle,
  lesson: lessonArticle,
  homework: homeworkArticle,
  textbooks: textbooksArticle,
  billing: billingArticle,
  bot: botArticle,
  appearance: appearanceArticle,
};
