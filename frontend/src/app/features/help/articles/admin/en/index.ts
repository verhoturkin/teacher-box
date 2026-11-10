import { HelpArticleText } from '@features/help/help.models';
import { AdminTopic } from '@features/help/help-topics';
import { diagnosticsArticle } from './diagnostics';
import { backupsArticle } from './backups';
import { settingsArticle } from './settings';

/** English help, written for administrators alongside the Russian edition. */
export const ADMIN_ARTICLES: Readonly<Record<AdminTopic, HelpArticleText>> = {
  diagnostics: diagnosticsArticle,
  backups: backupsArticle,
  settings: settingsArticle,
};
