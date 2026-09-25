import {
  BillingOverview,
  Lesson,
  MonthlyReport,
  Payment,
  StudentBalance,
  StudentLedger,
} from '@features/billing/data-access/billing.models';

export function studentBalance(overrides: Partial<StudentBalance> = {}): StudentBalance {
  return {
    studentId: 's-1',
    displayName: 'Иван Петров',
    status: 'ACTIVE',
    lessonPrice: 150_000,
    balance: 0,
    charged: 0,
    paid: 0,
    chargedLessons: 0,
    lastLessonDate: null,
    ...overrides,
  };
}

export function overview(students: StudentBalance[]): BillingOverview {
  return {
    currency: 'RUB',
    defaultLessonPrice: 150_000,
    defaultLessonDuration: 60,
    totalDebt: students.filter((s) => s.balance < 0).reduce((sum, s) => sum - s.balance, 0),
    totalPrepaid: students.filter((s) => s.balance > 0).reduce((sum, s) => sum + s.balance, 0),
    students,
  };
}

export function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l-1',
    studentId: 's-1',
    date: '2026-09-01',
    durationMinutes: 60,
    price: 150_000,
    topic: 'Дроби',
    status: 'CONDUCTED',
    createdAt: '2026-09-01T10:00:00Z',
    cancelledAt: null,
    cancelReason: null,
    ...overrides,
  };
}

export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p-1',
    studentId: 's-1',
    amount: 500_000,
    paidOn: '2026-09-03',
    method: 'TRANSFER',
    comment: 'за сентябрь',
    createdAt: '2026-09-03T10:00:00Z',
    voidedAt: null,
    voidReason: null,
    ...overrides,
  };
}

export function ledger(overrides: Partial<StudentLedger> = {}): StudentLedger {
  return {
    currency: 'RUB',
    studentId: 's-1',
    displayName: 'Иван Петров',
    lessonPrice: 150_000,
    balance: 350_000,
    charged: 150_000,
    paid: 500_000,
    lessons: [lesson()],
    payments: [payment()],
    ...overrides,
  };
}

export function monthlyReport(overrides: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    month: '2026-09',
    currency: 'RUB',
    income: 500_000,
    charged: 300_000,
    conductedLessons: 1,
    missedLessons: 1,
    cancelledLessons: 1,
    students: [{ studentId: 's-1', displayName: 'Иван Петров', chargedLessons: 2, charged: 300_000, paid: 500_000 }],
    lessons: [
      { studentName: 'Иван Петров', lesson: lesson({ id: 'l-1', status: 'CONDUCTED' }) },
      { studentName: 'Иван Петров', lesson: lesson({ id: 'l-2', status: 'MISSED', topic: null }) },
      { studentName: 'Иван Петров', lesson: lesson({ id: 'l-3', status: 'CANCELLED' }) },
    ],
    payments: [{ studentName: 'Иван Петров', payment: payment() }],
    ...overrides,
  };
}
