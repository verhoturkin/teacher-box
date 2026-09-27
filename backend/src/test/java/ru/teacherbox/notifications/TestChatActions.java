package ru.teacherbox.notifications;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import ru.teacherbox.schedule.api.LessonChangeRequested;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatOffer;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.error.BusinessRuleException;

/** Actions of the bot for the tests of the dialogs: nothing like them exists in the notifications module. */
public final class TestChatActions {

    public static final String SUBJECT = "test-subject";

    private TestChatActions() {
    }

    /** Everyone: writes a text, confirms it; accepts or declines a subject from under a notification. */
    public static final class Feedback implements ChatAction {

        private final List<String> saved = new CopyOnWriteArrayList<>();

        public List<String> saved() {
            return List.copyOf(saved);
        }

        @Override
        public String id() {
            return "test.feedback";
        }

        @Override
        public String title() {
            return "Отзыв";
        }

        @Override
        public int order() {
            return 10;
        }

        @Override
        public boolean availableTo(ChatUser user) {
            return true;
        }

        @Override
        public ChatStep start(ChatUser user) {
            return ChatStep.ask(ChatReply.of("Напишите отзыв"), ChatState.EMPTY.withStep("text"));
        }

        @Override
        public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
            Optional<String> subject = state.get("subject");
            if (subject.isPresent()) {
                return ChatKit.choice(input, "accept").isPresent()
                        ? ChatStep.changed(ChatReply.of("Принято: " + subject.get()), "accepted " + subject.get())
                        : ChatStep.done("Отклонено: " + subject.get());
            }
            if (state.at("text")) {
                return ChatKit.text(input)
                        .map(text -> ChatKit.confirm("Отправить «" + text + "»?", state.withStep("confirm").with("text", text)))
                        .orElseGet(() -> ChatStep.ask(ChatReply.of("Нужен текст"), state));
            }
            if (ChatKit.confirmed(input)) {
                saved.add(user.id() + " " + state.get("text").orElseThrow());
                return ChatStep.changed(ChatReply.of("Спасибо!").row(ChatButton.link("Портал", "https://school.example.com")),
                        "feedback-saved");
            }
            return ChatStep.done("Хорошо, не отправляю");
        }

        @Override
        public Optional<ChatOffer> offer(ChatUser user, ChatSubject subject) {
            if (!SUBJECT.equals(subject.type()) && !LessonChangeRequested.CHAT_SUBJECT.equals(subject.type())) {
                return Optional.empty();
            }
            return Optional.of(new ChatOffer(List.of(List.of(ChatButton.choice("Принять", "accept"),
                    ChatButton.choice("Отклонить", "decline"))), ChatState.of("subject", subject.id().toString())));
        }
    }

    /** The teacher only; offers nothing. */
    public static final class TeacherOnly implements ChatAction {

        @Override
        public String id() {
            return "test.teacher";
        }

        @Override
        public String title() {
            return "Для учителя";
        }

        @Override
        public int order() {
            return 20;
        }

        @Override
        public boolean availableTo(ChatUser user) {
            return user.isTeacher();
        }

        @Override
        public ChatStep start(ChatUser user) {
            return ChatStep.done("Только учителю");
        }

        @Override
        public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
            return ChatStep.done("Только учителю");
        }

        @Override
        public Optional<ChatOffer> offer(ChatUser user, ChatSubject subject) {
            throw new IllegalStateException("offers are broken");
        }
    }

    /** Students: fails on purpose. */
    public static final class Broken implements ChatAction {

        @Override
        public String id() {
            return "test.broken";
        }

        @Override
        public String title() {
            return "Сломано";
        }

        @Override
        public int order() {
            return 30;
        }

        @Override
        public boolean availableTo(ChatUser user) {
            return user.isStudent();
        }

        @Override
        public ChatStep start(ChatUser user) {
            return ChatStep.ask(ChatReply.of("Как сломаться?").row(ChatButton.choice("Упасть", "boom"),
                    ChatButton.choice("Отказать", "refuse")), ChatState.EMPTY);
        }

        @Override
        public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
            if (ChatKit.choice(input, "refuse").isPresent()) {
                throw new BusinessRuleException("test.refused", "Refused on purpose");
            }
            throw new IllegalStateException("Broken on purpose");
        }
    }
}
