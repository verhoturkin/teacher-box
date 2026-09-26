/** Mirrors `BillingViews` of the backend. Amounts are integers in minor units of `currency`. */

export type LessonStatus = 'CONDUCTED' | 'MISSED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type StudentStatus = 'INVITED' | 'ACTIVE' | 'DEACTIVATED';

export interface Lesson {
  readonly id: string;
  readonly studentId: string;
  readonly date: string;
  readonly durationMinutes: number;
  readonly price: number;
  readonly topic: string | null;
  readonly status: LessonStatus;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
}

export interface Payment {
  readonly id: string;
  readonly studentId: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: PaymentMethod;
  readonly comment: string | null;
  readonly createdAt: string;
  readonly voidedAt: string | null;
  readonly voidReason: string | null;
}

/** What the lesson and payment dialogs need to know about a student. */
export interface BillingStudent {
  readonly studentId: string;
  readonly displayName: string;
  readonly lessonPrice: number;
}

export interface StudentBalance extends BillingStudent {
  readonly status: StudentStatus;
  /** Paid minus charged: negative is debt. */
  readonly balance: number;
  readonly charged: number;
  readonly paid: number;
  readonly chargedLessons: number;
  readonly lastLessonDate: string | null;
}

export interface BillingOverview {
  readonly currency: string;
  readonly defaultLessonPrice: number;
  readonly defaultLessonDuration: number;
  readonly totalDebt: number;
  readonly totalPrepaid: number;
  readonly students: StudentBalance[];
}

export interface StudentLedger {
  readonly currency: string;
  readonly studentId: string;
  readonly displayName: string;
  readonly lessonPrice: number;
  readonly balance: number;
  readonly charged: number;
  readonly paid: number;
  readonly lessons: Lesson[];
  readonly payments: Payment[];
}

export interface MonthlyStudentRow {
  readonly studentId: string;
  readonly displayName: string;
  readonly chargedLessons: number;
  readonly charged: number;
  readonly paid: number;
}

export interface JournalLesson {
  readonly studentName: string;
  readonly lesson: Lesson;
}

export interface JournalPayment {
  readonly studentName: string;
  readonly payment: Payment;
}

export interface MonthlyReport {
  readonly month: string;
  readonly currency: string;
  readonly income: number;
  readonly charged: number;
  readonly conductedLessons: number;
  readonly missedLessons: number;
  readonly cancelledLessons: number;
  readonly students: MonthlyStudentRow[];
  readonly lessons: JournalLesson[];
  readonly payments: JournalPayment[];
}

export interface RecordLessonRequest {
  readonly studentId: string;
  readonly date: string;
  readonly durationMinutes: number;
  readonly price: number;
  readonly topic: string | null;
  readonly status: Exclude<LessonStatus, 'CANCELLED'>;
}

export interface RecordPaymentRequest {
  readonly studentId: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: PaymentMethod;
  readonly comment: string | null;
}

/** A student who owes money; `balance` is negative. */
export interface Debtor {
  readonly studentId: string;
  readonly displayName: string;
  readonly balance: number;
}

/** Mirrors `BillingSummary`: finances at a glance. */
export interface BillingSummary {
  readonly currency: string;
  readonly totalDebt: number;
  /** Number of students with a negative balance. */
  readonly debtors: number;
  /** The largest debts first. */
  readonly topDebtors: Debtor[];
  /** Valid payments dated in the current month. */
  readonly income: number;
  /** `yyyy-MM`. */
  readonly month: string;
  /** A lesson price is set (by default or for a student). */
  readonly priceSet: boolean;
}

/** Mirrors `MyBillingSummary`. */
export interface MyBillingSummary {
  readonly currency: string;
  readonly balance: number;
  readonly lessonPrice: number;
  readonly lastPayment: Payment | null;
}

/** Lesson price of a group, charged to every participant. */
export interface GroupPrice {
  readonly groupId: string;
  readonly lessonPrice: number;
}

export interface GroupPrices {
  readonly currency: string;
  readonly prices: readonly GroupPrice[];
}
