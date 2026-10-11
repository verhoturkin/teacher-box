import type { Translation } from '@core/i18n/language';
import type { ru } from './ru';

export const en: Translation<typeof ru> = {
  attention: {
    title: 'Needs attention',
    nothing: 'Nothing urgent',
    unmarked: 'Mark the past lessons',
    requests: 'Requests to move or cancel',
    toReview: 'Work to review',
    overdue: 'Overdue assignments',
    failedDeliveries: 'Undelivered notifications',
  },
  checklist: {
    title: 'Getting started',
    progress: (done: number, total: number) => `Done ${String(done)} of ${String(total)}`,
    hide: 'Hide',
    student: 'Add a student',
    studentHint: 'and send them the invitation link',
    price: 'Set the lesson price',
    priceHint: 'held lessons will be charged to the student’s balance',
    messenger: 'Connect a messenger',
    messengerHint: 'you and your students will get notifications in Telegram, VK or MAX',
    lesson: 'Plan the first lesson',
    lessonHint: 'one-off or recurring — reminders come by themselves',
  },
  quickActions: {
    title: 'Quick actions',
    lesson: 'Lesson',
    payment: 'Payment',
    student: 'Student',
    assignment: 'Assignment',
  },
  studentHome: {
    title: 'Home',
    what: 'the lessons, assignments and balance',
  },
  welcome: {
    title: (portal: string) => `Welcome to «${portal}»!`,
    intro: 'Here is everything you need for the lessons:',
    schedule: 'Schedule',
    scheduleText: '— your lessons, the lesson link, cancelling and moving.',
    homework: 'Assignments',
    homeworkText: '— homework and the teacher’s answers.',
    billing: 'Payments',
    billingText: '— the balance and the payment history.',
    helpBefore: 'If something is unclear, open',
    help: 'the help',
    helpAfter: '— it explains everything step by step.',
    ok: 'Got it',
  },
  teacherHome: {
    title: 'Home',
    what: 'the lessons, assignments, notifications and finance',
  },
};
