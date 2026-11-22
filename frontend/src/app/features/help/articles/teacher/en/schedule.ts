import { HelpArticleText } from '@features/help/help.models';

export const scheduleArticle: HelpArticleText = {
  title: 'Schedule and requests',
  summary: 'Schedule lessons, set time off, record outcomes and respond to requests',
  body: `
## Schedule a lesson

Choose “Create” → “Lesson”, or “Schedule” → “Lesson” on a phone. Select a student or group, date, time and duration. A title, topic and video meeting \
link are optional.

If the title is blank, the student or group’s name is used. A default topic from their Profile tab fills the title when you select them; you can \
change or clear it. The separate Topic field describes that particular lesson and is not copied across a recurring schedule.

Set “Repeat” to once or every one to four weeks. The selected date determines the weekday. An end date is optional. By default, you can see the next \
12 weeks of recurring lessons; later dates appear automatically.

## Use the calendar

On a computer, choose a week or month view and use the mini calendar to jump to another day. Student requests and time off appear beside it. Filter \
lessons by student or group above the calendar; additional filters appear under “N more”.

On a phone, the schedule starts in agenda view with a week strip and the selected day’s lessons. Switch to Week, Month or Time off above the calendar.

Drag a lesson to suggest a new time, then choose “Reschedule” to save or “Undo reschedule” to put it back. The portal warns about conflicts before \
saving. In month view, selecting an empty day opens a lesson form at 10:00 with the default duration; adjust both as needed.

**Date and time.** Type the date and time (for example “17.11.2026”, “14:30” or “1430”) or pick them: the calendar icon opens a calendar in a dialog, and the clock icon opens a dial.

## Time off

Open “Time off” to mark a one-off period, such as a holiday, or weekly hours, such as lunch breaks and days off. Weekly periods can have start and \
end dates. Use 00:00–00:00 for a whole day.

Time off is hatched in the calendar. Edit or delete it from its ⋮ menu. Private labels, such as “Lunch”, are visible only to you.

Students see these periods as “Busy” and cannot request a lesson then. They cannot see your labels or other students’ details. You can still schedule \
a lesson during your own time off.

## Record outcomes and attendance

Open a lesson and choose “Completed” or “Missed”. The outcome is saved immediately and the lesson is charged accordingly. For groups, choose “Mark \
attendance” and record each student’s attendance.

An Undo message appears for six seconds after recording an outcome. Choose “Undo” to reverse the outcome and its charge. You can also select the same \
outcome again to clear it, or select another to change it. For groups, use “Clear outcome” in the ⋮ menu.

Past lessons without an outcome are outlined in red. You can record outcomes from the calendar, the phone agenda or “To do” on your home page.

## Lesson plan

Lesson details change with time. Before a lesson starts, the plan and the homework come straight after the time and the topic; once it \
has started, the outcome and the lesson summary come first, then the homework and the plan. The plan and the homework take one line each, \
such as “Plan: Present Simple” or “Homework: 2 assignments · 1 to review”. Select a line to expand it in place, and again to collapse it.

With no plan yet, the details show **+ Plan**. **Write** opens the editor of this lesson’s plan; the course is filled in from the \
student’s or group’s course. The plan saves itself and is attached to the lesson straight away; Done takes you back to the schedule. \
**With AI** (when the AI assistant is on) opens the same editor with the assistant. Choose **From templates**, pick a plan and choose Use: \
the lesson gets its own copy and the template stays as it is. A cancelled lesson cannot take a new plan.

An expanded plan shows its text, the textbook pages and the videos. The plan’s “⋮” menu has **Open in editor** and **Remove from \
lesson**, which removes the plan after you confirm and deletes this lesson’s copy; the template stays. Students in the lesson and their \
parents see the same line in their lesson details; when they expand it, they see the text, the textbook pages and the videos, with a \
transcript only when you show it. See Textbooks for more about plans.

## Lesson homework

With no homework yet, the details show **+ Homework** with Set and Link. Once there is homework, the “Homework: …” line says how many \
assignments there are and how many pieces of work are waiting for review; expanded, it lists the assignments linked to the lesson with their \
status (Not set, Set, To review) and the Set and Link buttons. **Set** opens the assignment editor for this lesson: the lesson’s students are already chosen, the course comes from the plan \
(or from the student’s or group’s course), the plan’s textbook pages and videos are already added — remove what you don’t need — and the \
due date is the next lesson. The assignment is linked to the lesson when it is first saved. **Link** lets you pick a recent assignment of \
the lesson’s students that isn’t linked to any lesson yet, or an assignment template: a template becomes a draft copy for the \
lesson’s students, which you can open, edit and set. In the “⋮” menu, **Unlink** takes the assignment off the lesson; the assignment \
itself stays. A cancelled lesson cannot take new homework.

## Share a lesson summary

Once a lesson has started, add a summary in its details. Summaries are unavailable for cancelled lessons and individual lessons marked Missed.

“What we covered” is visible to the lesson’s students and initially shows the lesson topic. “Next lesson topic” fills the next lesson’s topic if that \
field is empty. “Save” keeps your changes; “Send to student” or “Send to students” also sends a Lesson summary notification.

If AI is enabled, “Generate draft” uses the lesson topic, the assignments linked to the lesson and your notes to suggest a summary. Review it before sending. Completed \
lessons with summaries appear in the student or group’s lesson history. In the bot, choose “Add summary” after recording a completed lesson.

## Cancel, restore or delete

Use “Cancel lesson…” in the lesson’s ⋮ menu to enter a reason, say whether the student requested it and decide whether to charge. The lesson remains \
in the calendar, crossed out, and the student is notified. “Restore” reinstates it and notifies the student again; a conflict warning appears if the \
time is now occupied.

Deleting removes a lesson from the schedule, calendars and reports. Only scheduled or cancelled lessons can be deleted; clear a completed or missed \
outcome first. Deleting an upcoming scheduled lesson sends a cancellation notification.

When editing, cancelling or deleting a recurring lesson, choose “Only this lesson” or “This and future lessons”. The portal shows how many lessons \
will change. The boundary follows the original date, even if a lesson has been rescheduled. Completed, charged, cancelled and individually edited \
occurrences are preserved. Deleted occurrences are not generated again.

## Respond to student requests

Students and their parents can request a reschedule or cancellation in the portal or bot. A parent’s request is marked “from a parent” with \
their name, and both the student and the parent get your reply. Requests appear in “Student requests” and arrive as notifications with \
“Approve” and “Decline” buttons. In the portal, open a request to respond.

- **Reschedule:** approve the suggested time or pick another: the free windows of the day such as “9:00–11:30” fill in the start, or type any time yourself; a hint warns if it is \
taken. The portal warns about lessons, time off or \
Google Calendar events at that time; you \
can choose to proceed.
- **Late cancellation:** decide whether to mark the lesson as missed and charge for it.
- **Decline:** include a reply, for example to suggest another time.

A group member’s advance notice that they cannot attend is approved automatically.
`,
};
