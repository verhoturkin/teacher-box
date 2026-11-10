import { HelpArticleText } from '@features/help/help.models';

export const meetingsArticle: HelpArticleText = {
  title: 'Video meetings',
  summary: 'Use an external video service for a student or group',
  body: `
You can give a student or group a permanent Telemost, Zoom or other meeting link. Lessons, reminders and “Join lesson” will use it instead of the \
built-in [call room](/teacher/help/calls).

## Add or remove a link

Open “Students”, select the student or group, then open “Profile” → “Video meeting”. Create a meeting in your video service, paste its link and \
choose “Add link”. Changes in this section are saved immediately.

“Send to student” sends the link to the student’s account and connected messaging app. Without an external link, it sends the portal room link. \
Remove the external link to return to portal calls.

## Open a meeting

Choose “Start lesson” in the lesson details. On Windows, Telemost can open in its app. Use the arrow beside the button to choose “Open in browser” \
instead. This preference is saved on your computer and can be changed under “Settings” → “Lessons” → “Calls” with the “Open Telemost in the app” \
switch.

You can override the permanent link for a single lesson in its details.
`,
};
