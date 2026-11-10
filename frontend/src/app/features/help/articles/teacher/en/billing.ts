import { HelpArticleText } from '@features/help/help.models';

export const billingArticle: HelpArticleText = {
  title: 'Payments',
  summary: 'Track balances, record payments and review monthly totals',
  body: `
## How balances work

Completed lessons and absences without notice are charged at the student or group’s lesson price. Recorded payments add to the balance.

- **Credit:** money paid towards future lessons.
- **Outstanding balance:** the amount still due for lessons already charged.

## Payments overview

Use the arrows beside the month to move through your history. The summary shows payments received, lesson charges, outstanding balances and credit.

Transactions list payments, lessons and absences. A payment adds to the balance; a charge reduces it; an excused absence has no charge. Filter by \
All, Payments, Lessons or Absences, and optionally choose a student. The month and filters are kept in the address, so reloading or going back \
preserves them.

“By student” lists outstanding balances with “Send reminder”, students whose credit covers two lessons or fewer, and weekly payment totals. Select a \
name to open their Payments tab, or choose “View all students”. On a phone, these sections appear below the monthly figures.

## Record a payment

Choose “Create” → “Payment”, the Payment button in a student’s details, or “Payments” → “Payment” on a phone. Enter the student, amount, date and an \
optional comment. If you record a payment incorrectly, void it from the student’s Payments tab.

## Attach a receipt

A payment can include an image or PDF receipt up to 10 MB. Attach it in the payment form, or later using the paperclip beside the payment in the \
student’s history. You can replace or remove it there too. The student can open the receipt from their own payment history.

You can also send a receipt to the bot. It asks for the student and amount, then records the payment with the receipt attached. See [What the bot can \
do](/teacher/help/bot).

## Lesson prices and history

Change a student or group’s price on their Profile tab. Past lessons keep the price they were charged at.

The Payments tab shows balance, total charges, total payments and history. Use the cross beside a transaction to remove a lesson charge or void a \
payment. The record remains in the history. The latest 20 entries appear first; choose “Show more” for older entries.

For a lesson outside the schedule, add it with its original date and mark it Completed, or use “Add a lesson” in the bot.

## Monthly report

Choose “Monthly report” for income, completed lessons and totals by student. “Download CSV” exports the month’s full ledger for a spreadsheet \
application.
`,
};
