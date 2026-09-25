import { Lesson, Payment, StudentLedger } from '../data-access/billing.models';

interface EntryBase {
  readonly id: string;
  readonly date: string;
  readonly createdAt: string;
  /** Cancelled lesson or voided payment: shown, but not counted. */
  readonly inactive: boolean;
}

/** A row of the history: a lesson (charge) or a payment. */
export type LedgerEntry =
  | (EntryBase & { readonly kind: 'lesson'; readonly lesson: Lesson })
  | (EntryBase & { readonly kind: 'payment'; readonly payment: Payment });

/** Lessons and payments merged into one list, newest first. */
export function ledgerEntries(ledger: StudentLedger): LedgerEntry[] {
  const entries: LedgerEntry[] = [
    ...ledger.lessons.map(
      (lesson): LedgerEntry => ({
        kind: 'lesson',
        id: lesson.id,
        date: lesson.date,
        createdAt: lesson.createdAt,
        inactive: lesson.status === 'CANCELLED',
        lesson,
      }),
    ),
    ...ledger.payments.map(
      (payment): LedgerEntry => ({
        kind: 'payment',
        id: payment.id,
        date: payment.paidOn,
        createdAt: payment.createdAt,
        inactive: payment.voidedAt !== null,
        payment,
      }),
    ),
  ];
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
