package ru.teacherbox.meetings.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.meetings.application.RoomService;
import ru.teacherbox.meetings.application.RoomService.MyRoomView;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;

/** A student: the links to the video rooms — their own and their groups'. */
@Component
class JoinLessonChatAction implements ChatAction {

    private final RoomService rooms;

    JoinLessonChatAction(RoomService rooms) {
        this.rooms = rooms;
    }

    @Override
    public String id() {
        return "meetings.join";
    }

    @Override
    public String title() {
        return "Войти на урок";
    }

    @Override
    public String icon() {
        return ChatIcons.JOIN_LESSON;
    }

    @Override
    public int order() {
        return 15;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isStudent();
    }

    @Override
    public ChatStep start(ChatUser user) {
        List<MyRoomView> own = rooms.studentRooms(user.id());
        if (own.isEmpty()) {
            return ChatStep.done("Ссылки на видеовстречу пока нет — учитель пришлёт её перед уроком.");
        }
        ChatReply reply = ChatReply.of(own.size() == 1 ? "Ссылка на урок:" : "Ссылки на уроки:");
        for (MyRoomView room : own.subList(0, Math.min(own.size(), ChatKit.MAX_BUTTONS - 1))) {
            String label = room.groupName() == null ? "Войти на урок" : "Группа «" + room.groupName() + "»";
            reply = reply.row(ChatButton.link(label, room.joinUrl()));
        }
        return ChatStep.done(reply);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }
}
