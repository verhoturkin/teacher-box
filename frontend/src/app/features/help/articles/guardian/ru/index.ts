import { HelpArticleText } from '@features/help/help.models';
import { GuardianTopic } from '@features/help/help-topics';
import { startArticle } from './start';
import { viewArticle } from './view';
import { requestsArticle } from './requests';
import { notificationsArticle } from './notifications';
import { botArticle } from './bot';

/** Help articles of the parent: plain words, steps to click and short answers. */
export const GUARDIAN_ARTICLES: Readonly<Record<GuardianTopic, HelpArticleText>> = {
  start: startArticle,
  view: viewArticle,
  requests: requestsArticle,
  notifications: notificationsArticle,
  bot: botArticle,
};
