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
        @Override String unmarked() { return "Unmarked"; }
        @Override String cancelLesson() { return "Cancel a lesson"; }
        @Override String moveLesson() { return "Move a lesson"; }
        @Override String myRequests() { return "My requests"; }
        @Override String requests() { return "Requests"; }

        @Override String inGroup(String group) { return " — group “" + group + "”"; }
        @Override String groupOf(String group) { return "group “" + group + "”"; }
        @Override String aStudent() { return "a student"; }
        @Override String unknownStudent() { return "Student"; }
        @Override String status(LessonStatus status) {
            return switch (status) {
                case SCHEDULED -> "scheduled";
                case CONDUCTED -> "conducted";
                case MISSED -> "missed";
                case CANCELLED -> "cancelled";
            };
        }
        @Override String tooLong(int max) { return "Too long: at most " + max + " characters."; }
        @Override String dateNotUnderstood() { return "I didn't understand the date."; }

        @Override String todayHeading() { return "Today's lessons:"; }
        @Override String noLessonsToday() { return "No lessons today."; }
        @Override String unmarkedHeading() { return "Past lessons without a mark:"; }
        @Override String allMarked() { return "All past lessons are marked."; }
        @Override String whichToMark() { return "Which lesson shall I mark?"; }
        @Override String markedOrNotStarted() { return "This lesson is already marked or hasn't started yet."; }
        @Override String howWasIt() { return "How did the lesson go?"; }
        @Override String conducted() { return "Conducted"; }
        @Override String missed() { return "Missed"; }
        @Override String groupTooBig(int max) {
            return "The group has more than " + max + " students — mark the attendance on the portal, in the schedule.";
        }
        @Override String markWhoCame() { return "Mark who was at the lesson and press “Done”."; }
        @Override String excused(String name) { return name + " said they won't come."; }
        @Override String done() { return "Done"; }
        @Override String alreadyMarked() { return "This lesson is already marked."; }
        @Override String allExcused() { return "All the students said they won't come: cancel the lesson on the portal."; }
        @Override String confirmAttendance(List<String> came, List<String> missed) {
            return "Mark the attendance: present — " + (came.isEmpty() ? "nobody" : String.join(", ", came))
                    + (missed.isEmpty() ? "" : "; absent — " + String.join(", ", missed)) + "?";
        }
        @Override String chooseOutcome() { return "Choose: “Conducted” or “Missed”."; }
        @Override String confirmOutcome(String lesson, boolean conducted) {
            return "Mark the lesson " + lesson + " as " + (conducted ? "conducted" : "missed") + "?";
        }
        @Override String notMarking() { return "OK, not marking it."; }
        @Override String attendanceMarked() { return "Attendance marked."; }
        @Override String marked(LessonStatus status) { return "Marked: " + status(status) + "."; }
        @Override String markFailed() { return "Couldn't mark it: the lesson has changed. Open the list again."; }

        @Override String nothingToChange(boolean cancel) {
            return "There are no lessons you can " + (cancel ? "cancel" : "move")
                    + ": no planned lessons, or they already have requests.";
        }
        @Override String whichToChange(boolean cancel) {
            return cancel ? "Which lesson shall I cancel?" : "Which lesson shall I move?";
        }
        @Override String chooseByButton() { return "Choose a lesson with a button."; }
        @Override String whichDay() { return "Which day shall I move it to? Choose or type a date, e.g. 05.10."; }
        @Override String whatTime() { return "At what time? Type it, e.g. 18:30."; }
        @Override String timeNotUnderstood() { return "I didn't understand the time. Type it like this: 18:30."; }
        @Override String timePassed() { return "That time has already passed."; }
        @Override String teacherBusy() {
            return "The teacher is busy at that time. Type another time, e.g. 18:30, or start again: /menu.";
        }
        @Override String askReason() { return "Write the reason — the teacher will see it. Or press “No comment”."; }
        @Override String askComment() { return "Write a comment for the teacher or press “No comment”."; }
        @Override String noComment() { return "No comment"; }
        @Override String askToMove(String when, String to) {
            return "Ask the teacher to move the lesson on " + when + " to " + to + "?";
        }
        @Override String tellAbsence(String group, String when) {
            return "Tell the teacher you won't come to the lesson of the group “" + group + "” on " + when + "?";
        }
        @Override String askToCancel(String when) { return "Ask the teacher to cancel the lesson on " + when + "?"; }
        @Override String lateWarning() { return "The lesson is soon: the teacher may count it as missed."; }
        @Override String comment(String comment) { return "Comment: " + comment; }
        @Override String notSending() { return "OK, not sending anything."; }
        @Override String cannotChange() {
            return "This lesson can't be changed any more: it was moved, cancelled or already has a request.";
        }
        @Override String slotBusy() { return "Couldn't send the request: the teacher is already busy at that time."; }
        @Override String requestFailed() {
            return "Couldn't send the request: the lesson has changed or already has a request.";
        }
        @Override String absenceSent() { return "Done: the teacher will see you won't be there."; }
        @Override String requestSent() { return "The request is sent to the teacher. The answer will come here."; }

        @Override String noPlannedLessons() { return "No planned lessons yet."; }
        @Override String upcoming() { return "Upcoming lessons:"; }
        @Override String youWontCome() { return " (you said you won't come)"; }
        @Override String requestPending() { return " (your request awaits an answer)"; }
        @Override String andMore(int count) { return "…and " + count + " more"; }
        @Override String joinNearest() { return "Join the nearest lesson"; }

        @Override String noRequests() { return "No requests yet."; }
        @Override String yourRequests() { return "Your requests:"; }
        @Override String teacherAnswer(String answer) { return "Teacher: “" + answer + "”"; }
        @Override String canWithdraw() { return "A request without an answer can be withdrawn."; }
        @Override String withdraw(String when) { return "Withdraw: " + when; }
        @Override String confirmWithdraw(String request) { return "Withdraw the request: " + request + "?"; }
        @Override String requestStays() { return "OK, the request stays."; }
        @Override String cannotWithdraw() { return "This request can't be withdrawn any more: the teacher has answered it."; }
        @Override String withdrawn() { return "Request withdrawn."; }
        @Override String myMove(String when, @Nullable String to) {
            return "moving the lesson on " + when + (to == null ? "" : " to " + to);
        }
        @Override String myAbsence(String when) { return "won't come to the lesson on " + when; }
        @Override String myCancel(String when) { return "cancelling the lesson on " + when; }
        @Override String requestStatus(RequestStatus status) {
            return switch (status) {
                case PENDING -> "awaits an answer";
                case APPROVED -> "accepted";
                case DECLINED -> "declined";
                case WITHDRAWN -> "withdrawn";
                case OUTDATED -> "outdated";
            };
        }

        @Override String answered() { return "This request has already been answered or withdrawn."; }
        @Override String noNewRequests() { return "No new requests."; }
        @Override String studentsRequests() { return "Students' requests:"; }
        @Override String whichToAnswer() { return "Which one shall I answer?"; }
        @Override String lateCharge() { return "The cancellation is late. Count the lesson as missed (it will be charged)?"; }
        @Override String charge() { return "Count it"; }
        @Override String free() { return "Don't count it"; }
        @Override String askAnswer() {
            return "Write an answer to the student — e.g. propose another time. Or press “No answer”.";
        }
        @Override String noAnswer() { return "No answer"; }
        @Override String confirmDecline(String request, @Nullable String answer) {
            return "Decline the request: " + request + "?" + (answer == null ? "" : "\nAnswer: " + answer);
        }
        @Override String requestWaits() { return "OK, the request awaits an answer."; }
        @Override String youAreBusy() {
            return "You have another lesson or plans in the calendar at that time. Answer on the portal.";
        }
        @Override String acceptFailed() { return "Couldn't accept the request: the lesson has changed. Answer on the portal."; }
        @Override String lessonMoved() { return "Lesson moved. The student will get a notification."; }
        @Override String absenceMarked() { return "Marked that the student won't come. The student will get a notification."; }
        @Override String lessonCancelled() { return "Lesson cancelled. The student will get a notification."; }
        @Override String declined() { return "Request declined. The student will get the answer."; }
        @Override String theStudent() { return "the student"; }
        @Override String confirmMove(String student, String when, @Nullable String to) {
            return "Move the lesson (" + student + ") from " + when + " to " + (to == null ? "the proposed time" : to)
                    + "?";
        }
        @Override String confirmAbsence(String student, String group, String when, boolean charge) {
            return "Mark that " + student + " won't come to the lesson of the group “" + group + "” on " + when
                    + (charge ? " and count it as missed?" : "?");
        }
        @Override String confirmCancel(String student, String when, boolean charge) {
            return "Cancel the lesson (" + student + ") on " + when + (charge ? " and count it as missed?" : "?");
        }
        @Override String asksToMove(String student, String when, @Nullable String to) {
            return student + ": move the lesson on " + when + (to == null ? "" : " to " + to);
        }
        @Override String wontCome(String student, String group, String when) {
            return student + ": won't come to the lesson of the group “" + group + "” on " + when;
        }
        @Override String asksToCancel(String student, String when) {
            return student + ": cancel the lesson on " + when;
        }
        @Override String late() { return " (late)"; }
        @Override String quoted(String comment) { return " — “" + comment + "”"; }
        @Override String accept() { return "Accept"; }
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
