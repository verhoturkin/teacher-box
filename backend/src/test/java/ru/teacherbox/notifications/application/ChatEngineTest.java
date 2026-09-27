package ru.teacherbox.notifications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.security.Role;
import tools.jackson.databind.json.JsonMapper;

class ChatEngineTest {

    @Test
    void fitsButtonsIntoTheLimitsOfTheMessengers() {
        List<ChatButton> seven = IntStream.range(0, 7).mapToObj(i -> ChatButton.choice("b" + i, "v" + i)).toList();
        ChatButton cancel = ChatButton.choice("Отмена", ChatEngine.CANCEL);

        List<List<ChatButton>> split = ChatEngine.fit(List.of(seven), List.of());
        assertThat(split).extracting(List::size).containsExactly(5, 2);

        List<List<ChatButton>> capped = ChatEngine.fit(List.of(seven, seven), List.of(cancel));
        assertThat(capped).extracting(List::size).containsExactly(5, 2, 2, 1);
        assertThat(capped.getLast()).containsExactly(cancel);
    }

    @Test
    void readsCommands() {
        assertThat(ChatEngine.command("/menu@school_bot")).isEqualTo("/menu");
        assertThat(ChatEngine.command(" /START abcd ")).isEqualTo("/start");
        assertThat(ChatEngine.command("Меню")).isEqualTo("меню");
        assertThat(ChatEngine.command("Привет, как дела")).isEqualTo("привет, как дела");
    }

    @Test
    void actionsNeedValidUniqueIds() {
        assertThat(actions(action("b", 2), action("a", 2), action("c", 1)).availableTo(new ChatUser(UUID.randomUUID(), Role.STUDENT)).stream()
                .map(ChatAction::id)).containsExactly("c", "a", "b");
        assertThat(actions(action("a", 1)).find("a")).isPresent();
        assertThat(actions(action("a", 1)).find("b")).isEmpty();
        assertThatThrownBy(() -> actions(action("Bad id", 1))).hasMessage("Invalid chat action id: Bad id");
        assertThatThrownBy(() -> actions(action("same", 1), action("same", 2)))
                .hasMessage("Several chat actions with id same");
    }

    @Test
    void keyboardsTravelThroughTheDeliveryQueue() {
        KeyboardCodec codec = new KeyboardCodec(JsonMapper.builder().build());
        List<List<OutgoingButton>> rows = List.of(List.of(new OutgoingButton("Да", "abcdefghijkl:0", null),
                new OutgoingButton("Портал", null, "https://school.example.com")));

        assertThat(codec.write(List.of())).isNull();
        assertThat(codec.read(codec.write(rows))).isEqualTo(rows);
        assertThat(codec.read(null)).isEmpty();
        assertThat(codec.read("not json")).isEmpty();
        assertThat(codec.read("[[{\"label\":\"x\"}]]")).isEmpty();
    }

    @Test
    void messagesAndButtonsOfTheAdapters() {
        assertThat(OutgoingMessage.text("Привет").rows()).isEmpty();
        assertThat(new OutgoingMessage("t", List.of(List.of(), List.of(new OutgoingButton("a", "d", null)))).rows())
                .hasSize(1);
        assertThatThrownBy(() -> new OutgoingButton("a", null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new OutgoingButton("a", "d", "https://x")).isInstanceOf(IllegalArgumentException.class);
        assertThat(new IncomingMessage("1", null, "текст").press()).isNull();
    }

    private static ChatActions actions(ChatAction... actions) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        for (int i = 0; i < actions.length; i++) {
            beans.addBean("action" + i, actions[i]);
        }
        return new ChatActions(beans.getBeanProvider(ChatAction.class));
    }

    private static ChatAction action(String id, int order) {
        return new ChatAction() {
            @Override
            public String id() {
                return id;
            }

            @Override
            public String title() {
                return id;
            }

            @Override
            public int order() {
                return order;
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
    }
}
