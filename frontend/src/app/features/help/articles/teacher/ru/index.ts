import { HelpArticleText } from '@features/help/help.models';
import { TeacherTopic } from '@features/help/help-topics';
import { firstStepsArticle } from './first-steps';
import { setupArticle } from './setup';
import { studentsArticle } from './students';
import { groupsArticle } from './groups';
import { scheduleArticle } from './schedule';
import { callsArticle } from './calls';
import { meetingsArticle } from './meetings';
import { boardsArticle } from './boards';
import { homeworkArticle } from './homework';
import { textbooksArticle } from './textbooks';
import { aiArticle } from './ai';
import { billingArticle } from './billing';
import { notificationsArticle } from './notifications';
import { botArticle } from './bot';
import { calendarsArticle } from './calendars';
import { settingsArticle } from './settings';
import { appearanceArticle } from './appearance';
import { backupsArticle } from './backups';
import { faqArticle } from './faq';

/** Help articles: plain words, steps to click and short answers. */
export const TEACHER_ARTICLES: Readonly<Record<TeacherTopic, HelpArticleText>> = {
  'first-steps': firstStepsArticle,
  setup: setupArticle,
  students: studentsArticle,
  groups: groupsArticle,
  schedule: scheduleArticle,
  calls: callsArticle,
  meetings: meetingsArticle,
  boards: boardsArticle,
  homework: homeworkArticle,
  textbooks: textbooksArticle,
  ai: aiArticle,
  billing: billingArticle,
  notifications: notificationsArticle,
  bot: botArticle,
  calendars: calendarsArticle,
  settings: settingsArticle,
  appearance: appearanceArticle,
  backups: backupsArticle,
  faq: faqArticle,
};
