import { HelpArticleText } from '@features/help/help.models';

export const studentsArticle: HelpArticleText = {
  title: 'Students and invitations',
  summary: 'Add students, manage their details and control portal access',
  body: `
## Add a student

1. Choose “Create” → “Student”, or “Students” → “Add student” on a phone.
2. Select “Student” and enter their name. Email and phone are optional and visible to you and the student.
3. Copy the invitation link and send it to the student. Their Profile tab opens so you can add a private note, default topic, colour, lesson price \
and video meeting link.

The student chooses a username and password using the invitation. Links expire after a few days; generate a new one if needed.

## Find a student or group

Students and groups share one list. Search by name or filter by “All”, “Groups” or “Deactivated”. Archived groups also appear under Deactivated.

A student’s entry shows their photo or initials, name, next lesson and balance. Outstanding amounts are highlighted in red. “Invited” and \
“Deactivated” identify accounts that are not active. Hover over an invitation status to see its expiry date.

Select an entry to open its details on the right. On a phone, details replace the list; use the back arrow to return.

## Student details

The header shows the student’s name, when they joined, connected messaging apps and balance. “Message”, “Payment” and “Lesson” let you contact them, \
record a payment or schedule a lesson.

- **Overview:** upcoming lessons, outstanding assignments, recent transactions, messaging apps and the video meeting link. If no messaging app is \
connected, send a connection reminder.
- **Lessons:** individual and group lessons, split into upcoming and past. Recurring lessons are grouped; choose “Show all dates” to expand them. \
Rescheduled and cancelled lessons appear separately. Past lessons show the outcome and, for groups, the student’s attendance. Upcoming lessons cover \
the next six months. History loads 20 lessons at a time; choose “Show more” for older entries.
- **Homework:** assignments and their status, with outstanding work first and accepted work below. Select a title to open it.
- **Payments:** balance, total charges, total payments and transaction history. See [Payments](/teacher/help/billing).
- **Profile:** name, email, phone, private note, default topic and colour. Save these fields together. The lesson price has its own Save button; \
video meeting changes apply immediately. “Portal access” shows the read-only username and invitation or reset link details.

You always see the name you entered for the student, even if they choose a different display name for their account.

## Invitations and access

Open the student’s Profile tab to manage access:

- **New invitation** creates another link before the student has activated their account.
- **Reset password** creates a reset link for an existing account.
- **Deactivate account…** prevents sign-in while keeping lesson, payment and homework history.
- **Restore access** lets a deactivated student sign in again.

## Student tags

Tags are your private notes on a student, such as English level, school year or goal. Only you see
them; students and bots do not.

1. Open “Settings” → “Students” → “Student tags” and create a tag with a name and ordered values.
   If every student needs their own words, such as hobbies, choose “Free text”; it needs no
   values. An empty list offers templates: CEFR level, “Year group”, “Goal” and “Interests”. You
   can’t change a tag’s type while any student has it.
2. Keep “Use in AI” on if tasks, quizzes and reviews should adapt to the value.
3. On the student’s Tags tab, choose a value; it is saved straight away. Free text, up to 120
   characters, is saved when you press Enter or leave the field; clearing the field removes the
   tag. “What the AI will see” shows what the assistant receives.
4. In the student list, choose “Tags” and a value to show only those students. Free-text tags
   are not available as filters.

When you ask the AI for a draft, “What I know about the students” chips appear above the request. Remove a chip
with “×” to leave that tag out of this request. If the chosen students have different values or
texts, the chip is highlighted: select it and pick one. If all the texts together run over 120
characters, the AI gets the most common one until you pick another. If your request asks for something else, the AI follows
your request. Deleting a tag or a value clears it for every student, and this cannot be undone.

## Student colours

Choose one of ten colours, or “No colour”, on the Profile tab. The colour marks avatars, calendar lessons and selection chips throughout your view of \
the portal. Students do not see it.

Scheduled lessons use the student’s colour. Completed, missed and cancelled lessons use their status colour, with the student’s colour as a stripe \
along the edge.

For shared teaching, see [Groups](/teacher/help/groups). Boards are under [Materials](/teacher/help/boards).
`,
};
