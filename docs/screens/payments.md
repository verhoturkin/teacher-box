# Payments (teacher)

`features/billing/teacher/billing-overview-page.ts`: a flexible pane and, from medium, a supporting
pane by student.

- **Journal state in the address:** month, kind and student are `?month=&kind=&student=` (written
  with `replaceUrl`), so back from a student card and a reload bring the same journal. The month,
  figures and filters stay above the scroll; a name links to the card's payments tab.
- **Monthly report** (`monthly-report-page.ts`, nested route `/teacher/billing/report`): its CSV is
  the whole journal of the report's month regardless of filters (`operations.csv`, saved by
  `FileSaver`).
- **Supporting pane:** debtors with «remind», advances running out (≤ 2 lessons left, *ours*), weeks
  as bars, a link to Students. On compact the debtors move into the main pane under the figures
  (hidden when nobody owes); the rest of the pane and the student filter are hidden, and the FAB
  records a payment.
- **Ledger** (`billing/ledger/ledger-list.ts`, `tb-ledger-list`; also on the student card and the
  student's payments page): pages of 20; the teacher cancels a charge and manages receipts there.
