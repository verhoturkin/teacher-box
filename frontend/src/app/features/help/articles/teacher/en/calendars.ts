import { HelpArticleText } from '@features/help/help.models';

export const calendarsArticle: HelpArticleText = {
  title: 'Calendars',
  summary: 'Subscribe to your schedule or connect Google Calendar',
  body: `
## Calendar subscriptions

Open “Settings” → “Lessons” → “Calendar subscription” and choose “Get subscription link”. Add the link as a subscription in your phone or computer’s \
calendar app. Lessons update automatically.

Keep this link private: anyone with it can view the schedule. Generate a new link if it has been shared accidentally; the previous one stops working.

Students can create their own subscription links, which include only their lessons.

## Google Calendar

Open “Settings” → “Lessons” → “Google Calendar” and connect your account. Portal lessons appear in a separate calendar in Google Calendar. The portal \
also shows when you are busy with other Google Calendar events so you can avoid scheduling conflicts.
`,
};
