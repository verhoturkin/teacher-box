package ru.teacherbox.shared.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class ChatPickerTest {

    private static final String PROMPT = "Выберите ученика";
    private static final List<ChatPicker.Option> STUDENTS = List.of(
            new ChatPicker.Option("s1", "Анна Смирнова"),
            new ChatPicker.Option("s2", "Борис Иванов"),
            new ChatPicker.Option("s3", "Вера Петрова"),
            new ChatPicker.Option("s4", "Глеб Иванов"),
            new ChatPicker.Option("s5", "Дина Орлова"),
            new ChatPicker.Option("s6", "Мария Кузнецова"),
            new ChatPicker.Option("s7", "Олег Сидоров"));

    @Test
    void showsPagesWithAHintToSearch() {
        ChatReply first = ChatPicker.show(PROMPT, STUDENTS);
        assertThat(first.text()).isEqualTo(PROMPT + "\nМожно написать часть имени.");
        assertThat(ChatKitTest.labels(first.rows())).containsExactly("Анна Смирнова", "Борис Иванов", "Вера Петрова",
                "Глеб Иванов", "Дина Орлова", "Ещё ›");
        assertThat(ChatPicker.show(PROMPT, STUDENTS.subList(0, 2)).text()).isEqualTo(PROMPT);

        ChatPicker.Result next = ChatPicker.handle(PROMPT, STUDENTS, ChatState.EMPTY, new ChatInput.Choice("page:1"));
        assertThat(next).isInstanceOfSatisfying(ChatPicker.Shown.class, shown -> {
            assertThat(ChatKitTest.labels(shown.reply().rows())).containsExactly("Мария Кузнецова", "Олег Сидоров",
                    "‹ Назад");
            assertThat(shown.state().get("picker.page")).contains("1");
        });
        ChatPicker.Result same = ChatPicker.handle(PROMPT, STUDENTS, ChatState.of("picker.page", "1"),
                new ChatInput.Choice("unknown"));
        assertThat(same).isInstanceOfSatisfying(ChatPicker.Shown.class,
                shown -> assertThat(ChatKitTest.labels(shown.reply().rows())).startsWith("Мария Кузнецова"));
    }

    @Test
    void picksByButtonOrBySearch() {
        ChatState state = ChatState.of("picker.page", "1").withStep("student");

        assertThat(ChatPicker.handle(PROMPT, STUDENTS, state, new ChatInput.Choice("pick:s6")))
                .isEqualTo(new ChatPicker.Picked("s6", ChatState.EMPTY.withStep("student")));
        assertThat(ChatPicker.handle(PROMPT, STUDENTS, state, new ChatInput.Text("мари")))
                .isEqualTo(new ChatPicker.Picked("s6", ChatState.EMPTY.withStep("student")));
        assertThat(ChatPicker.handle(PROMPT, STUDENTS, state, new ChatInput.Text("иванов")))
                .isInstanceOfSatisfying(ChatPicker.Shown.class, shown -> {
                    assertThat(shown.reply().text()).startsWith("Нашлось несколько.");
                    assertThat(ChatKitTest.labels(shown.reply().rows())).containsExactly("Борис Иванов", "Глеб Иванов");
                });
        assertThat(ChatPicker.handle(PROMPT, STUDENTS, state, new ChatInput.Text("Яков")))
                .isInstanceOfSatisfying(ChatPicker.Shown.class,
                        shown -> assertThat(shown.reply().text()).startsWith("По запросу «Яков» ничего не нашлось."));
        assertThat(ChatPicker.handle(PROMPT, STUDENTS, state, new ChatInput.Choice("pick:gone")))
                .isInstanceOfSatisfying(ChatPicker.Shown.class,
                        shown -> assertThat(shown.reply().text()).startsWith("Этого варианта уже нет."));
    }
}
