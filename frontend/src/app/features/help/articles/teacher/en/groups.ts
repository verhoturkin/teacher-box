import { HelpArticleText } from '@features/help/help.models';

export const groupsArticle: HelpArticleText = {
  title: 'Groups',
  summary: 'Teach several students together and manage their shared lessons',
  body: `
A group brings together students who attend the same lessons. Its lesson price is charged separately to each member.

## Create and manage a group

1. Choose “Create” → “Student”, or the add button in Students on a phone, then select “Group”.
2. Enter a name, select the students and choose “Create”.
3. Set the price per student on the group’s Profile tab. You can also add a default topic and colour.

Groups appear in the Students list with a group icon, member count and next lesson. Use the Groups filter to find them.

Select a group to open its details. “Message” contacts every member and “Lesson” schedules a group lesson. The ⋮ menu contains “Archive” or “Restore \
from archive”.

- **Overview:** upcoming lessons and the room link.
- **Lessons:** upcoming and past group lessons and their outcomes.
- **Homework:** members’ assignments, with each student’s name and status.
- **Members:** add or remove students. Select a name to open that student’s details.
- **Profile:** name, default topic, colour, price per member and video meeting link.

## Attendance and membership

Choose the group when scheduling a lesson. All members will see it. After the lesson, record who attended and who missed it. Students who attended or \
were absent without notice are charged. Students who reported an absence in advance are not charged.

Membership changes apply to upcoming lessons. Past lessons keep their original participants.

Archive a group when you stop teaching it. Upcoming lessons are cancelled and the history is kept. Find archived groups under the Deactivated filter.
`,
};
