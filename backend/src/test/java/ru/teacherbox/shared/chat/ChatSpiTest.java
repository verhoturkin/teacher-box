package ru.teacherbox.shared.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.teacherbox.shared.security.Role;

class ChatSpiTest {

    @Test
    void stateKeepsShortValues() {
        UUID id = UUID.randomUUID();
        ChatState state = ChatState.EMPTY.with("lesson", id.toString()).withStep("confirm").with("bad", "x");

        assertThat(state.step()).isEqualTo("confirm");
        assertThat(state.at("confirm")).isTrue();
        assertThat(state.at("date")).isFalse();
        assertThat(state.id("lesson")).contains(id);
        assertThat(state.id("bad")).isEmpty();
        assertThat(state.id("missing")).isEmpty();
        assertThat(state.without("lesson").get("lesson")).isEmpty();
        assertThat(ChatState.EMPTY.step()).isNull();
        assertThat(ChatState.of("a", "1").values()).containsEntry("a", "1");
        assertThatThrownBy(() -> state.values().put("x", "y")).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void buttonsAreChoicesOrLinks() {
        assertThat(ChatButton.choice("Да", "yes")).isEqualTo(new ChatButton("Да", "yes", null));
        assertThat(ChatButton.link("Портал", "https://school.example.com").url()).isEqualTo("https://school.example.com");
        assertThatThrownBy(() -> new ChatButton(" ", "yes", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ChatButton("Оба", "yes", "https://x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ChatButton("Никак", null, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void repliesCollectRowsOfButtons() {
        ChatReply reply = ChatReply.of("Текст")
                .row(ChatButton.choice("1", "1"), ChatButton.choice("2", "2"))
                .rows(List.of(List.of(ChatButton.choice("3", "3")), List.of()));

        assertThat(reply.rows()).hasSize(2);
        assertThat(reply.buttons()).isEqualTo(3);
        assertThat(new ChatOffer(List.of(List.of(), List.of(ChatButton.choice("1", "1"))), ChatState.EMPTY).rows())
                .hasSize(1);
    }

    @Test
    void stepsAskOrFinish() {
        assertThat(ChatStep.ask(ChatReply.of("?"), ChatState.EMPTY)).isInstanceOf(ChatStep.Ask.class);
        assertThat(ChatStep.done("Готово")).isEqualTo(new ChatStep.Done(ChatReply.of("Готово"), null));
        assertThat(ChatStep.done(ChatReply.of("Готово")).reply().text()).isEqualTo("Готово");
        assertThat(ChatStep.changed(ChatReply.of("Записано"), "payment 1"))
                .isEqualTo(new ChatStep.Done(ChatReply.of("Записано"), "payment 1"));
    }

    @Test
    void usersInputsAndSubjects() {
        ChatUser teacher = new ChatUser(UUID.randomUUID(), Role.TEACHER);
        ChatUser student = new ChatUser(UUID.randomUUID(), Role.STUDENT);
        assertThat(teacher.isTeacher()).isTrue();
        assertThat(teacher.isStudent()).isFalse();
        assertThat(student.isStudent()).isTrue();
        assertThat(new ChatInput.Text("  привет ").text()).isEqualTo("привет");
        assertThat(new ChatSubject("change-request", teacher.id()).type()).isEqualTo("change-request");

        ChatAction plain = new ChatAction() {
            @Override
            public String id() {
                return "plain";
            }

            @Override
            public String title() {
                return "Простое";
            }

            @Override
            public int order() {
                return 0;
            }

            @Override
            public boolean availableTo(ChatUser user) {
                return true;
            }

            @Override
            public ChatStep start(ChatUser user) {
                return ChatStep.done("ok");
            }

            @Override
            public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
                return ChatStep.done("ok");
            }
        };
        assertThat(plain.offer(teacher, new ChatSubject("any", teacher.id()))).isEqualTo(Optional.empty());
    }
}
