package ru.teacherbox.schedule.chat;

import java.util.List;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.schedule.domain.LessonStatus;
import ru.teacherbox.schedule.domain.RequestStatus;
import ru.teacherbox.shared.i18n.Language;

/** Texts of the schedule actions of the bot in each language (ADR-0036); dates come formatted ({@code ChatText}). */
enum ScheduleChatTexts {

    RU {
        @Override String schedule() { return "Расписание"; }
        @Override String today() { return "Сегодня"; }
        @Override String unmarked() { return "Неотмеченные"; }
        @Override String cancelLesson() { return "Отменить занятие"; }
        @Override String moveLesson() { return "Перенести занятие"; }
        @Override String myRequests() { return "Мои запросы"; }
        @Override String requests() { return "Запросы"; }

        @Override String inGroup(String group) { return " — группа «" + group + "»"; }
        @Override String groupOf(String group) { return "группа «" + group + "»"; }
        @Override String aStudent() { return "ученик"; }
        @Override String unknownStudent() { return "Ученик"; }
        @Override String status(LessonStatus status) {
            return switch (status) {
                case SCHEDULED -> "запланировано";
                case CONDUCTED -> "проведено";
                case MISSED -> "пропуск";
                case CANCELLED -> "отменено";
            };
        }
        @Override String tooLong(int max) { return "Слишком длинно: не больше " + max + " символов."; }
        @Override String dateNotUnderstood() { return "Не понял дату."; }

        @Override String todayHeading() { return "Занятия сегодня:"; }
        @Override String noLessonsToday() { return "Сегодня занятий нет."; }
        @Override String unmarkedHeading() { return "Прошедшие занятия без отметки:"; }
        @Override String allMarked() { return "Все прошедшие занятия отмечены."; }
        @Override String whichToMark() { return "Какое занятие отметить?"; }
        @Override String markedOrNotStarted() { return "Это занятие уже отмечено или ещё не началось."; }
        @Override String howWasIt() { return "Как прошло занятие?"; }
        @Override String conducted() { return "Проведено"; }
        @Override String missed() { return "Пропуск"; }
        @Override String groupTooBig(int max) {
            return "В группе больше " + max + " учеников — отметьте посещаемость на портале, в расписании.";
        }
        @Override String markWhoCame() { return "Отметьте, кто был на занятии, и нажмите «Готово»."; }
        @Override String excused(String name) { return name + " предупредил(а), что не придёт."; }
        @Override String done() { return "Готово"; }
        @Override String alreadyMarked() { return "Это занятие уже отмечено."; }
        @Override String allExcused() { return "Все ученики предупредили, что не придут: отмените занятие на портале."; }
        @Override String confirmAttendance(List<String> came, List<String> missed) {
            return "Отметить посещаемость: были — " + (came.isEmpty() ? "никто" : String.join(", ", came))
                    + (missed.isEmpty() ? "" : "; не было — " + String.join(", ", missed)) + "?";
        }
        @Override String chooseOutcome() { return "Выберите: «Проведено» или «Пропуск»."; }
        @Override String confirmOutcome(String lesson, boolean conducted) {
            return "Отметить занятие " + lesson + " как " + (conducted ? "проведённое" : "пропуск") + "?";
        }
        @Override String notMarking() { return "Хорошо, не отмечаю."; }
        @Override String attendanceMarked() { return "Посещаемость отмечена."; }
        @Override String marked(LessonStatus status) { return "Отмечено: " + status(status) + "."; }
        @Override String markFailed() { return "Не получилось отметить: занятие изменилось. Откройте список ещё раз."; }
        @Override String offerSummary(String marked) { return marked + " Записать итоги занятия?"; }
        @Override String writeSummary() { return "Записать итоги"; }
        @Override String skipSummary() { return "Пропустить"; }
        @Override String summarySkipped() { return "Хорошо. Итоги можно записать позже на портале."; }
        @Override String askSummary(int max) {
            return "Напишите одним сообщением, что прошли на занятии (не больше " + max + " символов).";
        }
        @Override String summarySaved(boolean group) {
            return "Итоги сохранены. Отправить " + (group ? "ученикам" : "ученику") + "?";
        }
        @Override String sendSummary(boolean group) { return group ? "Отправить ученикам" : "Отправить ученику"; }
        @Override String summaryKept() { return "Итоги сохранены, ученикам они не отправлены."; }
        @Override String summarySent() { return "Итоги отправлены."; }
        @Override String summaryFailed() { return "Не получилось записать итоги: занятие изменилось."; }

        @Override String nothingToChange(boolean cancel) {
            return "Нет занятий, которые можно " + (cancel ? "отменить" : "перенести")
                    + ": запланированных занятий нет или по ним уже есть запросы.";
        }
        @Override String whichToChange(boolean cancel) {
            return cancel ? "Какое занятие отменить?" : "Какое занятие перенести?";
        }
        @Override String chooseByButton() { return "Выберите занятие кнопкой."; }
        @Override String whichDay() { return "На какой день перенести? Выберите или напишите дату, например 05.10."; }
        @Override String whatTime() { return "Во сколько? Напишите время, например 18:30."; }
        @Override String timeNotUnderstood() { return "Не понял время. Напишите его так: 18:30."; }
        @Override String timePassed() { return "Это время уже прошло."; }
        @Override String teacherBusy() {
            return "В это время учитель занят. Напишите другое время, например 18:30, или начните заново: /menu.";
        }
        @Override String askReason() { return "Напишите причину — учитель её увидит. Или нажмите «Без комментария»."; }
        @Override String askComment() { return "Напишите комментарий для учителя или нажмите «Без комментария»."; }
        @Override String noComment() { return "Без комментария"; }
        @Override String askToMove(String when, String to) {
            return "Попросить учителя перенести занятие " + when + " на " + to + "?";
        }
        @Override String tellAbsence(String group, String when) {
            return "Сообщить учителю, что вы не придёте на занятие группы «" + group + "» " + when + "?";
        }
        @Override String askToCancel(String when) { return "Попросить учителя отменить занятие " + when + "?"; }
        @Override String lateWarning() { return "До занятия осталось мало времени: учитель может засчитать его как пропуск."; }
        @Override String comment(String comment) { return "Комментарий: " + comment; }
        @Override String notSending() { return "Хорошо, ничего не отправляю."; }
        @Override String cannotChange() {
            return "Это занятие уже нельзя изменить: его перенесли, отменили или по нему уже есть запрос.";
        }
        @Override String slotBusy() { return "Не получилось отправить запрос: в это время учитель уже занят."; }
        @Override String requestFailed() {
            return "Не получилось отправить запрос: занятие изменилось или по нему уже есть запрос.";
        }
        @Override String absenceSent() { return "Готово: учитель увидит, что вас не будет."; }
        @Override String requestSent() { return "Запрос отправлен учителю. Ответ придёт сюда."; }

        @Override String noPlannedLessons() { return "Запланированных занятий пока нет."; }
        @Override String upcoming() { return "Ближайшие занятия:"; }
        @Override String youWontCome() { return " (вы предупредили, что не придёте)"; }
        @Override String requestPending() { return " (ваш запрос ждёт ответа)"; }
        @Override String andMore(int count) { return "…и ещё " + count; }
        @Override String joinNearest() { return "Войти на ближайший урок"; }

        @Override String noRequests() { return "Запросов пока нет."; }
        @Override String yourRequests() { return "Ваши запросы:"; }
        @Override String teacherAnswer(String answer) { return "Учитель: «" + answer + "»"; }
        @Override String canWithdraw() { return "Запрос без ответа можно отозвать."; }
        @Override String withdraw(String when) { return "Отозвать: " + when; }
        @Override String confirmWithdraw(String request) { return "Отозвать запрос: " + request + "?"; }
        @Override String requestStays() { return "Хорошо, запрос остаётся."; }
        @Override String cannotWithdraw() { return "Этот запрос уже нельзя отозвать: учитель ответил на него."; }
        @Override String withdrawn() { return "Запрос отозван."; }
        @Override String myMove(String when, @Nullable String to) {
            return "перенос занятия " + when + (to == null ? "" : " на " + to);
        }
        @Override String myAbsence(String when) { return "не приду на занятие " + when; }
        @Override String myCancel(String when) { return "отмена занятия " + when; }
        @Override String requestStatus(RequestStatus status) {
            return switch (status) {
                case PENDING -> "ждёт ответа";
                case APPROVED -> "принят";
                case DECLINED -> "отклонён";
                case WITHDRAWN -> "отозван";
                case OUTDATED -> "устарел";
            };
        }

        @Override String answered() { return "На этот запрос уже ответили или его отозвали."; }
        @Override String noNewRequests() { return "Новых запросов нет."; }
        @Override String studentsRequests() { return "Запросы учеников:"; }
        @Override String whichToAnswer() { return "На какой ответить?"; }
        @Override String lateCharge() { return "Отмена поздняя. Засчитать занятие как пропуск (оно будет оплачено)?"; }
        @Override String charge() { return "Засчитать"; }
        @Override String free() { return "Не засчитывать"; }
        @Override String askAnswer() {
            return "Напишите ответ ученику — например, предложите другое время. Или нажмите «Без ответа».";
        }
        @Override String noAnswer() { return "Без ответа"; }
        @Override String confirmDecline(String request, @Nullable String answer) {
            return "Отклонить запрос: " + request + "?" + (answer == null ? "" : "\nОтвет: " + answer);
        }
        @Override String requestWaits() { return "Хорошо, запрос ждёт ответа."; }
        @Override String youAreBusy() {
            return "В это время у вас другое занятие или дела в календаре. Ответьте на портале.";
        }
        @Override String acceptFailed() { return "Не получилось принять запрос: занятие изменилось. Ответьте на портале."; }
        @Override String lessonMoved() { return "Занятие перенесено. Ученик получит уведомление."; }
        @Override String absenceMarked() { return "Отмечено, что ученик не придёт. Ученик получит уведомление."; }
        @Override String lessonCancelled() { return "Занятие отменено. Ученик получит уведомление."; }
        @Override String declined() { return "Запрос отклонён. Ученик получит ответ."; }
        @Override String theStudent() { return "ученика"; }
        @Override String confirmMove(String student, String when, @Nullable String to) {
            return "Перенести занятие (" + student + ") с " + when + " на " + (to == null ? "предложенное время" : to)
                    + "?";
        }
        @Override String confirmAbsence(String student, String group, String when, boolean charge) {
            return "Отметить, что " + student + " не придёт на занятие группы «" + group + "» " + when
                    + (charge ? " и засчитать его как пропуск?" : "?");
        }
        @Override String confirmCancel(String student, String when, boolean charge) {
            return "Отменить занятие (" + student + ") " + when + (charge ? " и засчитать его как пропуск?" : "?");
        }
        @Override String asksToMove(String student, String when, @Nullable String to) {
            return student + ": перенести занятие " + when + (to == null ? "" : " на " + to);
        }
        @Override String wontCome(String student, String group, String when) {
            return student + ": не придёт на занятие группы «" + group + "» " + when;
        }
        @Override String asksToCancel(String student, String when) { return student + ": отменить занятие " + when; }
        @Override String late() { return " (поздно)"; }
        @Override String quoted(String comment) { return " — «" + comment + "»"; }
        @Override String accept() { return "Принять"; }
        @Override String decline() { return "Отклонить"; }
    },

    EN {
        @Override String schedule() { return "Schedule"; }
        @Override String today() { return "Today"; }
        @Override String unmarked() { return "Attendance to record"; }
        @Override String cancelLesson() { return "Cancel a lesson"; }
        @Override String moveLesson() { return "Reschedule a lesson"; }
        @Override String myRequests() { return "My requests"; }
        @Override String requests() { return "Requests"; }

        @Override String inGroup(String group) { return " — group “" + group + "”"; }
        @Override String groupOf(String group) { return "group “" + group + "”"; }
        @Override String aStudent() { return "a student"; }
        @Override String unknownStudent() { return "Student"; }
        @Override String status(LessonStatus status) {
            return switch (status) {
                case SCHEDULED -> "scheduled";
                case CONDUCTED -> "completed";
                case MISSED -> "missed";
                case CANCELLED -> "cancelled";
            };
        }
        @Override String tooLong(int max) { return "Please use " + max + " characters or fewer."; }
        @Override String dateNotUnderstood() { return "I couldn't read that date. Please try again."; }

        @Override String todayHeading() { return "Today's lessons:"; }
        @Override String noLessonsToday() { return "No lessons today."; }
        @Override String unmarkedHeading() { return "Past lessons awaiting attendance:"; }
        @Override String allMarked() { return "Attendance has been recorded for all past lessons."; }
        @Override String whichToMark() { return "Which lesson would you like to record attendance for?"; }
        @Override String markedOrNotStarted() { return "Attendance has already been recorded for this lesson, or it hasn't started yet."; }
        @Override String howWasIt() { return "How did the lesson go?"; }
        @Override String conducted() { return "Completed"; }
        @Override String missed() { return "Missed"; }
        @Override String groupTooBig(int max) { return "This group has more than " + max + " students. Please record attendance in the portal's schedule."; }
        @Override String markWhoCame() { return "Select the students who attended, then choose “Done”."; }
        @Override String excused(String name) { return name + " let you know they wouldn't be attending."; }
        @Override String done() { return "Done"; }
        @Override String alreadyMarked() { return "Attendance has already been recorded for this lesson."; }
        @Override String allExcused() { return "No students will be attending. Please cancel the lesson on the portal."; }
        @Override String confirmAttendance(List<String> came, List<String> missed) { return "Record attendance? Present: " + (came.isEmpty() ? "no one" : String.join(", ", came)) + (missed.isEmpty() ? "" : "; absent: " + String.join(", ", missed)) + "."; }
        @Override String chooseOutcome() { return "Choose “Completed” or “Missed”."; }
        @Override String confirmOutcome(String lesson, boolean conducted) { return "Mark lesson " + lesson + " as " + (conducted ? "completed" : "missed") + "?"; }
        @Override String notMarking() { return "OK, attendance unchanged."; }
        @Override String attendanceMarked() { return "Attendance recorded."; }
        @Override String marked(LessonStatus status) { return "Marked: " + status(status) + "."; }
        @Override String markFailed() { return "Couldn't record attendance because the lesson has changed. Open the list and try again."; }
        @Override String offerSummary(String marked) { return marked + " Would you like to add a lesson summary?"; }
        @Override String writeSummary() { return "Add summary"; }
        @Override String skipSummary() { return "Skip"; }
        @Override String summarySkipped() { return "Okay. You can write the summary later on the portal."; }
        @Override String askSummary(int max) { return "Describe what you covered in one message (" + max + " characters maximum)."; }
        @Override String summarySaved(boolean group) {
            return "Summary saved. Send it to the " + (group ? "students" : "student") + "?";
        }
        @Override String sendSummary(boolean group) { return group ? "Send to students" : "Send to student"; }
        @Override String summaryKept() { return "Summary saved. It hasn't been sent to the students."; }
        @Override String summarySent() { return "Summary sent."; }
        @Override String summaryFailed() { return "Couldn't save the summary because the lesson has changed."; }

        @Override String nothingToChange(boolean cancel) { return "No lessons are available to " + (cancel ? "cancel" : "reschedule") + ". There are no upcoming lessons, or a request is already pending for each one."; }
        @Override String whichToChange(boolean cancel) { return "Which lesson would you like to " + (cancel ? "cancel" : "reschedule") + "?"; }
        @Override String chooseByButton() { return "Select a lesson using the buttons below."; }
        @Override String whichDay() { return "What date would you like? Select a day or enter a date, such as 05.10."; }
        @Override String whatTime() { return "What time would you like? Enter a time, such as 18:30."; }
        @Override String timeNotUnderstood() { return "I couldn't read that time. Use the format 18:30."; }
        @Override String timePassed() { return "That time has already passed."; }
        @Override String teacherBusy() { return "Your teacher is unavailable then. Enter another time, such as 18:30, or send /menu to start again."; }
        @Override String askReason() { return "Tell your teacher why, or choose “No comment”."; }
        @Override String askComment() { return "Add a message for your teacher, or choose “No comment”."; }
        @Override String noComment() { return "No comment"; }
        @Override String askToMove(String when, String to) { return "Ask your teacher to reschedule the lesson from " + when + " to " + to + "?"; }
        @Override String tellAbsence(String group, String when) { return "Let your teacher know you can't attend the “" + group + "” lesson on " + when + "?"; }
        @Override String askToCancel(String when) { return "Ask your teacher to cancel the lesson on " + when + "?"; }
        @Override String lateWarning() { return "The lesson starts soon. Your teacher may mark it as missed."; }
        @Override String comment(String comment) { return "Comment: " + comment; }
        @Override String notSending() { return "OK, nothing sent."; }
        @Override String cannotChange() { return "This lesson has been rescheduled or cancelled, or a request is already pending."; }
        @Override String slotBusy() { return "Couldn't send the request. Your teacher is no longer available at that time."; }
        @Override String requestFailed() { return "Couldn't send the request. The lesson has changed or another request is already pending."; }
        @Override String absenceSent() { return "Your teacher has been notified that you can't attend."; }
        @Override String requestSent() { return "Request sent to your teacher. You'll receive their reply here."; }

        @Override String noPlannedLessons() { return "No upcoming lessons."; }
        @Override String upcoming() { return "Upcoming lessons:"; }
        @Override String youWontCome() { return " (you're not attending)"; }
        @Override String requestPending() { return " (awaiting your teacher's reply)"; }
        @Override String andMore(int count) { return "…and " + count + " more"; }
        @Override String joinNearest() { return "Join next lesson"; }

        @Override String noRequests() { return "No requests yet."; }
        @Override String yourRequests() { return "Your requests:"; }
        @Override String teacherAnswer(String answer) { return "Teacher: “" + answer + "”"; }
        @Override String canWithdraw() { return "You can withdraw a request until your teacher replies."; }
        @Override String withdraw(String when) { return "Withdraw: " + when; }
        @Override String confirmWithdraw(String request) { return "Withdraw the request: " + request + "?"; }
        @Override String requestStays() { return "OK, your request is still pending."; }
        @Override String cannotWithdraw() { return "Your teacher has already replied, so this request can no longer be withdrawn."; }
        @Override String withdrawn() { return "Request withdrawn."; }
        @Override String myMove(String when, @Nullable String to) { return "reschedule the lesson on " + when + (to == null ? "" : " to " + to); }
        @Override String myAbsence(String when) { return "absence from the lesson on " + when; }
        @Override String myCancel(String when) { return "cancel the lesson on " + when; }
        @Override String requestStatus(RequestStatus status) {
            return switch (status) {
                case PENDING -> "pending";
                case APPROVED -> "approved";
                case DECLINED -> "declined";
                case WITHDRAWN -> "withdrawn";
                case OUTDATED -> "no longer applicable";
            };
        }

        @Override String answered() { return "This request has already been answered or withdrawn."; }
        @Override String noNewRequests() { return "No new requests."; }
        @Override String studentsRequests() { return "Students' requests:"; }
        @Override String whichToAnswer() { return "Which request would you like to respond to?"; }
        @Override String lateCharge() { return "This is a late cancellation. Mark the lesson as missed and charge for it?"; }
        @Override String charge() { return "Charge for lesson"; }
        @Override String free() { return "Don't charge"; }
        @Override String askAnswer() { return "Add a reply to the student, for example to suggest another time, or choose “Skip reply”."; }
        @Override String noAnswer() { return "Skip reply"; }
        @Override String confirmDecline(String request, @Nullable String answer) { return "Decline the request: " + request + "?" + (answer == null ? "" : "\nReply: " + answer); }
        @Override String requestWaits() { return "OK, the request is still pending."; }
        @Override String youAreBusy() { return "You have a lesson or another calendar event at that time. Please respond on the portal."; }
        @Override String acceptFailed() { return "Couldn't approve the request because the lesson has changed. Please respond on the portal."; }
        @Override String lessonMoved() { return "Lesson rescheduled. The student will be notified."; }
        @Override String absenceMarked() { return "Absence recorded. The student will be notified."; }
        @Override String lessonCancelled() { return "Lesson cancelled. The student will be notified."; }
        @Override String declined() { return "Request declined. Your reply will be sent to the student."; }
        @Override String theStudent() { return "the student"; }
        @Override String confirmMove(String student, String when, @Nullable String to) { return "Reschedule the lesson with " + student + " from " + when + " to " + (to == null ? "the requested time" : to) + "?"; }
        @Override String confirmAbsence(String student, String group, String when, boolean charge) { return "Record " + student + "'s absence from the “" + group + "” lesson on " + when + (charge ? " and mark it as missed?" : "?"); }
        @Override String confirmCancel(String student, String when, boolean charge) { return "Cancel the lesson with " + student + " on " + when + (charge ? " and mark it as missed?" : "?"); }
        @Override String asksToMove(String student, String when, @Nullable String to) { return student + ": reschedule the lesson on " + when + (to == null ? "" : " to " + to); }
        @Override String wontCome(String student, String group, String when) { return student + ": can't attend the “" + group + "” lesson on " + when; }
        @Override String asksToCancel(String student, String when) {
            return student + ": cancel the lesson on " + when;
        }
        @Override String late() { return " (late)"; }
        @Override String quoted(String comment) { return " — “" + comment + "”"; }
        @Override String accept() { return "Approve"; }
        @Override String decline() { return "Decline"; }
    };

    static ScheduleChatTexts of(Language language) {
        return switch (language) {
            case RU -> RU;
            case EN -> EN;
        };
    }

    // titles of the actions

    abstract String schedule();

    abstract String today();

    abstract String unmarked();

    abstract String cancelLesson();

    abstract String moveLesson();

    abstract String myRequests();

    abstract String requests();

    // lessons

    /** « — группа «ОГЭ»», after a lesson's time. */
    abstract String inGroup(String group);

    /** «группа «ОГЭ»», who the lesson is with. */
    abstract String groupOf(String group);

    abstract String aStudent();

    abstract String unknownStudent();

    abstract String status(LessonStatus status);

    abstract String tooLong(int max);

    abstract String dateNotUnderstood();

    // marking lessons (the teacher)

    abstract String todayHeading();

    abstract String noLessonsToday();

    abstract String unmarkedHeading();

    abstract String allMarked();

    abstract String whichToMark();

    abstract String markedOrNotStarted();

    abstract String howWasIt();

    abstract String conducted();

    abstract String missed();

    abstract String groupTooBig(int max);

    abstract String markWhoCame();

    abstract String excused(String name);

    abstract String done();

    abstract String alreadyMarked();

    abstract String allExcused();

    abstract String confirmAttendance(List<String> came, List<String> missed);

    abstract String chooseOutcome();

    abstract String confirmOutcome(String lesson, boolean conducted);

    abstract String notMarking();

    abstract String attendanceMarked();

    abstract String marked(LessonStatus status);

    abstract String markFailed();

    abstract String offerSummary(String marked);

    abstract String writeSummary();

    abstract String skipSummary();

    abstract String summarySkipped();

    abstract String askSummary(int max);

    abstract String summarySaved(boolean group);

    abstract String sendSummary(boolean group);

    abstract String summaryKept();

    abstract String summarySent();

    abstract String summaryFailed();

    // a student's request to cancel or move a lesson

    abstract String nothingToChange(boolean cancel);

    abstract String whichToChange(boolean cancel);

    abstract String chooseByButton();

    abstract String whichDay();

    abstract String whatTime();

    abstract String timeNotUnderstood();

    abstract String timePassed();

    abstract String teacherBusy();

    abstract String askReason();

    abstract String askComment();

    abstract String noComment();

    abstract String askToMove(String when, String to);

    abstract String tellAbsence(String group, String when);

    abstract String askToCancel(String when);

    abstract String lateWarning();

    abstract String comment(String comment);

    abstract String notSending();

    abstract String cannotChange();

    abstract String slotBusy();

    abstract String requestFailed();

    abstract String absenceSent();

    abstract String requestSent();

    // a student's schedule

    abstract String noPlannedLessons();

    abstract String upcoming();

    abstract String youWontCome();

    abstract String requestPending();

    abstract String andMore(int count);

    abstract String joinNearest();

    // a student's requests

    abstract String noRequests();

    abstract String yourRequests();

    abstract String teacherAnswer(String answer);

    abstract String canWithdraw();

    abstract String withdraw(String when);

    abstract String confirmWithdraw(String request);

    abstract String requestStays();

    abstract String cannotWithdraw();

    abstract String withdrawn();

    abstract String myMove(String when, @Nullable String to);

    abstract String myAbsence(String when);

    abstract String myCancel(String when);

    abstract String requestStatus(RequestStatus status);

    // the teacher's answers to requests

    abstract String answered();

    abstract String noNewRequests();

    abstract String studentsRequests();

    abstract String whichToAnswer();

    abstract String lateCharge();

    abstract String charge();

    abstract String free();

    abstract String askAnswer();

    abstract String noAnswer();

    abstract String confirmDecline(String request, @Nullable String answer);

    abstract String requestWaits();

    abstract String youAreBusy();

    abstract String acceptFailed();

    abstract String lessonMoved();

    abstract String absenceMarked();

    abstract String lessonCancelled();

    abstract String declined();

    /** The student whose name is unknown, as the object of a question. */
    abstract String theStudent();

    abstract String confirmMove(String student, String when, @Nullable String to);

    abstract String confirmAbsence(String student, String group, String when, boolean charge);

    abstract String confirmCancel(String student, String when, boolean charge);

    abstract String asksToMove(String student, String when, @Nullable String to);

    abstract String wontCome(String student, String group, String when);

    abstract String asksToCancel(String student, String when);

    abstract String late();

    abstract String quoted(String comment);

    abstract String accept();

    abstract String decline();
}
