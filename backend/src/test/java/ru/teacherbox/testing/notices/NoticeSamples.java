package ru.teacherbox.testing.notices;

import static ru.teacherbox.testing.notices.SamplePeople.ANNA;
import static ru.teacherbox.testing.notices.SamplePeople.BORIS;
import static ru.teacherbox.testing.notices.SamplePeople.GROUP;
import static ru.teacherbox.testing.notices.SamplePeople.LOST_GROUP;
import static ru.teacherbox.testing.notices.SamplePeople.STRANGER;
import static ru.teacherbox.testing.notices.SamplePeople.TEACHER;
import static ru.teacherbox.testing.notices.SamplePeople.VERA;
import static ru.teacherbox.testing.notices.SamplePeople.id;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Currency;
import java.util.List;
import ru.teacherbox.billing.api.LessonCancelled;
import ru.teacherbox.billing.api.LessonRecorded;
import ru.teacherbox.billing.api.PaymentRecorded;
import ru.teacherbox.billing.api.PaymentVoided;
import ru.teacherbox.homework.api.HomeworkAssigned;
import ru.teacherbox.homework.api.HomeworkDueSoon;
import ru.teacherbox.homework.api.HomeworkReminderRequested;
import ru.teacherbox.homework.api.HomeworkReviewed;
import ru.teacherbox.homework.api.HomeworkSubmitted;
import ru.teacherbox.identity.api.StudentActivated;
import ru.teacherbox.meetings.api.MeetingLinkShared;
import ru.teacherbox.schedule.api.CancelledBy;
import ru.teacherbox.schedule.api.ChangeKind;
import ru.teacherbox.schedule.api.GoogleCalendarDisconnected;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.schedule.api.LessonChangeResolved;
import ru.teacherbox.schedule.api.LessonDeleted;
import ru.teacherbox.schedule.api.LessonRepeatScheduled;
import ru.teacherbox.schedule.api.LessonRepeatStopped;
import ru.teacherbox.schedule.api.LessonRescheduled;
import ru.teacherbox.schedule.api.LessonRestored;
import ru.teacherbox.schedule.api.LessonScheduled;
import ru.teacherbox.schedule.api.LessonStartingSoon;
import ru.teacherbox.schedule.api.LessonSummaryShared;
import ru.teacherbox.schedule.api.ScheduledLessonCancelled;
import ru.teacherbox.shared.money.Money;
import ru.teacherbox.testing.notices.NoticeGolden.Sample;

/**
 * The events the modules notify about, one per branch of the texts. The golden files of
 * {@link NoticeGolden} were written from these samples: adding one is fine, changing one changes
 * what the files compare.
 */
public final class NoticeSamples {

    /** The time zone of the samples. */
    public static final ZoneId ZONE = ZoneId.of("Europe/Moscow");
    /** Thursday, 01.10.2026 18:00 in Moscow. */
    private static final Instant START = Instant.parse("2026-10-01T15:00:00Z");
    /** Friday, 02.10.2026 19:30 in Moscow. */
    private static final Instant LATER = Instant.parse("2026-10-02T16:30:00Z");
    /** Before both lessons. */
    private static final Instant EARLIER = Instant.parse("2026-09-30T09:00:00Z");
    /** 25.09.2026 18:30 in Moscow. */
    private static final Instant DUE = Instant.parse("2026-09-25T15:30:00Z");
    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);
    private static final String ROOM = "https://telemost.yandex.ru/j/5";
    private static final Currency RUB = Currency.getInstance("RUB");

    private NoticeSamples() {
    }

    public static List<Sample> schedule() {
        return List.of(
                new Sample("lesson planned: title and topic", new LessonScheduled(id(101), null, List.of(ANNA), START,
                        60, "Английский", "Дроби", EARLIER)),
                new Sample("lesson planned: bare", new LessonScheduled(id(102), null, List.of(VERA), START, 60, null,
                        null, EARLIER)),
                new Sample("lesson planned: group, topic", new LessonScheduled(id(103), GROUP, List.of(ANNA, BORIS),
                        LATER, 90, null, "Past Simple", EARLIER)),
                new Sample("lesson planned: lost group, title", new LessonScheduled(id(104), LOST_GROUP,
                        List.of(BORIS), START, 60, "Maths", null, EARLIER)),
                new Sample("lesson planned: nobody", new LessonScheduled(id(105), null, List.of(), START, 60, null,
                        null, EARLIER)),

                new Sample("repeat: two days, every 2 weeks, till", new LessonRepeatScheduled(id(111), null,
                        List.of(ANNA), List.of(DayOfWeek.THURSDAY, DayOfWeek.TUESDAY), LocalTime.of(18, 0), 60, 2,
                        LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), EARLIER)),
                new Sample("repeat: weekly, open", new LessonRepeatScheduled(null, null, List.of(VERA),
                        List.of(DayOfWeek.MONDAY), LocalTime.of(9, 0), 60, 1, LocalDate.of(2026, 10, 5), null,
                        EARLIER)),
                new Sample("repeat: group, three days, every 5 weeks", new LessonRepeatScheduled(id(113), GROUP,
                        List.of(ANNA, BORIS), List.of(DayOfWeek.FRIDAY, DayOfWeek.WEDNESDAY, DayOfWeek.SUNDAY),
                        LocalTime.of(12, 30), 90, 5, LocalDate.of(2026, 10, 2), LocalDate.of(2027, 5, 31), EARLIER)),
                new Sample("repeat: every 21 weeks, saturday", new LessonRepeatScheduled(id(114), null, List.of(BORIS),
                        List.of(DayOfWeek.SATURDAY), LocalTime.of(7, 5), 45, 21, LocalDate.of(2026, 10, 3), null,
                        EARLIER)),
                new Sample("repeat stopped: replaced", new LessonRepeatStopped(id(121), null, List.of(ANNA),
                        LocalDate.of(2026, 10, 5), true, EARLIER)),
                new Sample("repeat stopped", new LessonRepeatStopped(id(122), null, List.of(ANNA),
                        LocalDate.of(2026, 10, 5), false, EARLIER)),
                new Sample("repeat stopped: group", new LessonRepeatStopped(null, GROUP, List.of(ANNA, BORIS),
                        LocalDate.of(2026, 11, 1), false, EARLIER)),

                new Sample("moved", new LessonRescheduled(id(131), null, List.of(ANNA), START, LATER, 60, null,
                        EARLIER)),
                new Sample("moved: group, asked by Anna", new LessonRescheduled(id(132), GROUP, List.of(ANNA, BORIS),
                        START, LATER, 90, ANNA, EARLIER)),
                new Sample("moved: by request", new LessonRescheduled(id(133), null, List.of(VERA), LATER, START, 60,
                        VERA, EARLIER)),

                new Sample("cancelled: by request", new ScheduledLessonCancelled(id(141), null, List.of(ANNA), START,
                        CancelledBy.STUDENT, "Заболел", false, true, EARLIER)),
                new Sample("cancelled: reason, charged", new ScheduledLessonCancelled(id(142), null, List.of(ANNA),
                        START, CancelledBy.STUDENT, "Заболел", true, false, EARLIER)),
                new Sample("cancelled: bare", new ScheduledLessonCancelled(id(143), null, List.of(VERA), LATER,
                        CancelledBy.TEACHER, null, false, false, EARLIER)),
                new Sample("cancelled: group, reason", new ScheduledLessonCancelled(id(144), GROUP,
                        List.of(ANNA, BORIS), START, CancelledBy.TEACHER, "Праздник.", false, false, EARLIER)),
                new Sample("cancelled: group, charged", new ScheduledLessonCancelled(id(145), GROUP, List.of(BORIS),
                        START, CancelledBy.TEACHER, null, true, false, EARLIER)),

                new Sample("deleted: planned, ahead", new LessonDeleted(id(151), null, List.of(ANNA), START, true,
                        EARLIER)),
                new Sample("deleted: group", new LessonDeleted(id(152), GROUP, List.of(ANNA, BORIS), START, true,
                        EARLIER)),
                new Sample("deleted: not planned", new LessonDeleted(id(153), null, List.of(ANNA), START, false,
                        EARLIER)),
                new Sample("deleted: passed", new LessonDeleted(id(154), null, List.of(ANNA), START, true, LATER)),
                new Sample("deleted: at its start", new LessonDeleted(id(155), null, List.of(ANNA), START, true,
                        START)),
                new Sample("restored: ahead", new LessonRestored(id(161), null, List.of(VERA), LATER, 60, EARLIER)),
                new Sample("restored: group", new LessonRestored(id(162), GROUP, List.of(ANNA, BORIS), LATER, 60,
                        EARLIER)),
                new Sample("restored: passed", new LessonRestored(id(163), null, List.of(VERA), START, 60, LATER)),

                new Sample("request: move, proposal, comment", new LessonChangeRequested(id(171), id(172), ANNA, null,
                        ChangeKind.RESCHEDULE, START, LATER, "Можно позже?", false, false, EARLIER)),
                new Sample("request: cancel, late", new LessonChangeRequested(id(173), id(172), VERA, null,
                        ChangeKind.CANCEL, START, null, null, true, false, EARLIER)),
                new Sample("request: absence, accepted, comment", new LessonChangeRequested(id(174), id(172), BORIS,
                        GROUP, ChangeKind.CANCEL, START, null, "Уезжаю", false, true, EARLIER)),
                new Sample("request: absence, late", new LessonChangeRequested(id(175), id(172), ANNA, GROUP,
                        ChangeKind.CANCEL, START, null, null, true, false, EARLIER)),
                new Sample("request: move of a group lesson", new LessonChangeRequested(id(176), id(172), ANNA, GROUP,
                        ChangeKind.RESCHEDULE, START, null, null, false, false, EARLIER)),
                new Sample("request: cancel, stranger, lost group", new LessonChangeRequested(id(177), id(172),
                        STRANGER, LOST_GROUP, ChangeKind.CANCEL, START, null, "Не смогу", true, true, EARLIER)),

                new Sample("answer: move declined", new LessonChangeResolved(id(181), id(172), ANNA, null,
                        ChangeKind.RESCHEDULE, false, START, false, null, EARLIER)),
                new Sample("answer: cancel declined, comment", new LessonChangeResolved(id(182), id(172), VERA, null,
                        ChangeKind.CANCEL, false, START, false, "Перед контрольной нельзя", EARLIER)),
                new Sample("answer: absence declined", new LessonChangeResolved(id(183), id(172), BORIS, GROUP,
                        ChangeKind.CANCEL, false, START, false, null, EARLIER)),
                new Sample("answer: move agreed, comment", new LessonChangeResolved(id(184), id(172), ANNA, null,
                        ChangeKind.RESCHEDULE, true, LATER, false, "Договорились", EARLIER)),
                new Sample("answer: cancel agreed, charged", new LessonChangeResolved(id(185), id(172), VERA, null,
                        ChangeKind.CANCEL, true, START, true, null, EARLIER)),
                new Sample("answer: cancel agreed", new LessonChangeResolved(id(186), id(172), VERA, null,
                        ChangeKind.CANCEL, true, START, false, null, EARLIER)),
                new Sample("answer: absence known, charged, comment", new LessonChangeResolved(id(187), id(172), BORIS,
                        GROUP, ChangeKind.CANCEL, true, START, true, "Жаль", EARLIER)),
                new Sample("answer: move of a group lesson agreed, charged", new LessonChangeResolved(id(188), id(172),
                        ANNA, GROUP, ChangeKind.RESCHEDULE, true, LATER, true, null, EARLIER)),
                new Sample("answer: move of a group lesson declined", new LessonChangeResolved(id(189), id(172), ANNA,
                        GROUP, ChangeKind.RESCHEDULE, false, START, false, null, EARLIER)),

                new Sample("soon: a day before", new LessonStartingSoon(id(191), null, List.of(ANNA), START, 60, null,
                        null, null, Duration.ofHours(24), false, EARLIER)),
                new Sample("soon: last, topic, room", new LessonStartingSoon(id(192), null, List.of(VERA), START, 60,
                        null, "Дроби", "https://zoom.us/j/1", Duration.ofHours(1), true, EARLIER)),
                new Sample("soon: group, title, last", new LessonStartingSoon(id(193), GROUP, List.of(ANNA, BORIS),
                        START, 90, "Английский", null, null, Duration.ofMinutes(30), true, EARLIER)),
                new Sample("soon: group, everything, room, not last", new LessonStartingSoon(id(194), GROUP,
                        List.of(BORIS), LATER, 90, "Maths", "Fractions", ROOM, Duration.ofDays(2), false, EARLIER)),
                new Sample("soon: nobody, last, room", new LessonStartingSoon(id(195), null, List.of(), START, 60,
                        null, null, ROOM, Duration.ofMinutes(21), true, EARLIER)),
                new Sample("soon: lost group, last", new LessonStartingSoon(id(196), LOST_GROUP, List.of(ANNA, VERA),
                        START, 60, null, null, null, Duration.ofHours(3), true, EARLIER)),
                new Sample("soon: room only", new LessonStartingSoon(id(197), null, List.of(ANNA), START, 60, null,
                        null, ROOM, Duration.ofMinutes(1), false, EARLIER)),

                new Sample("summary", new LessonSummaryShared(id(201), List.of(ANNA, VERA), TEACHER, START, LATER)),
                new Sample("summary: nobody", new LessonSummaryShared(id(202), List.of(), TEACHER, START, LATER)),
                new Sample("calendar lost", new GoogleCalendarDisconnected("invalid_grant", EARLIER)));
    }

    public static List<Sample> homework() {
        return List.of(
                new Sample("assigned: deadline", new HomeworkAssigned(id(301), id(302), ANNA, "Дроби", DUE, EARLIER)),
                new Sample("assigned: no deadline", new HomeworkAssigned(id(303), id(302), VERA, "Essay", null,
                        EARLIER)),
                new Sample("due soon", new HomeworkDueSoon(id(304), id(302), BORIS, "Дроби", DUE, EARLIER)),
                new Sample("reminder: deadline", new HomeworkReminderRequested(id(305), id(302), ANNA, "Дроби", DUE,
                        EARLIER)),
                new Sample("reminder: no deadline", new HomeworkReminderRequested(id(306), id(302), ANNA, "Дроби",
                        null, EARLIER)),
                new Sample("accepted: grade", new HomeworkReviewed(id(307), id(302), ANNA, "Дроби", true, "5",
                        EARLIER)),
                new Sample("accepted: no grade", new HomeworkReviewed(id(308), id(302), VERA, "Essay", true, null,
                        EARLIER)),
                new Sample("returned", new HomeworkReviewed(id(309), id(302), BORIS, "Дроби", false, null, EARLIER)),
                new Sample("returned: grade ignored", new HomeworkReviewed(id(310), id(302), BORIS, "Дроби", false,
                        "2", EARLIER)),
                new Sample("submitted", new HomeworkSubmitted(id(311), id(302), ANNA, "Дроби", EARLIER)),
                new Sample("submitted: stranger", new HomeworkSubmitted(id(312), id(302), STRANGER, "Дроби",
                        EARLIER)));
    }

    public static List<Sample> billing() {
        return List.of(
                new Sample("lesson: debt", new LessonRecorded(id(401), ANNA, DAY, 60, rub(150_000), false,
                        rub(-150_000), EARLIER)),
                new Sample("lesson: missed, zero", new LessonRecorded(id(402), BORIS, DAY, 60, rub(150_050), true,
                        rub(0), EARLIER)),
                new Sample("lesson: balance left", new LessonRecorded(id(403), VERA, DAY, 45, rub(99_950), false,
                        rub(123_456_789), EARLIER)),
                new Sample("lesson: dollars", new LessonRecorded(id(404), VERA, DAY, 45,
                        Money.of(2_500, Currency.getInstance("USD")), true,
                        Money.of(-7_550, Currency.getInstance("USD")), EARLIER)),
                new Sample("charge removed", new LessonCancelled(id(405), ANNA, DAY, rub(0), EARLIER)),
                new Sample("charge removed: debt", new LessonCancelled(id(406), BORIS, DAY, rub(-5), EARLIER)),
                new Sample("payment", new PaymentRecorded(id(407), ANNA, rub(300_000), DAY, rub(150_000), EARLIER)),
                new Sample("payment: still in debt", new PaymentRecorded(id(408), VERA, rub(100_050), DAY,
                        rub(-49_950), EARLIER)),
                new Sample("payment voided", new PaymentVoided(id(409), BORIS, rub(300_000), rub(-10_000), EARLIER)),
                new Sample("payment voided: balance left", new PaymentVoided(id(410), ANNA, rub(1_000), rub(20_000),
                        EARLIER)));
    }

    public static List<Sample> meetings() {
        return List.of(
                new Sample("room of a student", new MeetingLinkShared(VERA, null, List.of(VERA), "https://zoom.us/j/1",
                        EARLIER)),
                new Sample("room of a group", new MeetingLinkShared(GROUP, GROUP, List.of(ANNA, BORIS), ROOM,
                        EARLIER)),
                new Sample("room of a lost group", new MeetingLinkShared(LOST_GROUP, LOST_GROUP, List.of(ANNA), ROOM,
                        EARLIER)),
                new Sample("room for nobody", new MeetingLinkShared(GROUP, GROUP, List.of(), ROOM, EARLIER)));
    }

    public static List<Sample> identity() {
        return List.of(
                new Sample("student joined", new StudentActivated(ANNA, "Анна Иванова", EARLIER)),
                new Sample("student joined: latin name", new StudentActivated(VERA, "Vera Smith", EARLIER)));
    }

    private static Money rub(long kopecks) {
        return Money.of(kopecks, RUB);
    }
}
