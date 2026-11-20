import { HelpArticleText } from '@features/help/help.models';

export const requestsArticle: HelpArticleText = {
  title: 'Rescheduling and cancelling',
  summary: 'Ask to move or cancel your child’s lesson',
  body: `
A parent can ask the teacher to reschedule or cancel a child’s lesson. Open the lesson on Home or in “Schedule” and choose “Reschedule” or “Cancel”. To reschedule, suggest a new time; \
times when the teacher is busy are marked “Busy”, and the free windows of the chosen day are shown below the date field. You can add a message for the teacher.

For a group lesson the button is “Can’t attend” instead: if you tell the teacher in advance, the lesson is not charged.

## What happens next

The teacher sees the request marked “from a parent” with your name. The reply reaches both you and your child as a notification. The status is shown in the “Requests” section of the \
schedule. Until the teacher replies, \
you can withdraw the request with “Withdraw” beside the lesson.

A late cancellation may be charged as a missed lesson. A request applies only to the lesson you chose, even if it repeats every week.

Your child’s requests and your own are listed together in “Requests”.

You can do the same through the bot: [Messaging bot](/guardian/help/bot).
`,
};
