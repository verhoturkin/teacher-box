package ru.teacherbox.boards.chat;

import java.util.List;
import org.springframework.stereotype.Component;
import ru.teacherbox.boards.application.BoardService;
import ru.teacherbox.boards.application.BoardService.MyBoardView;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;

/** A student: links to their boards and their groups' boards. */
@Component
class MyBoardsChatAction implements ChatAction {

    private final BoardService boards;

    MyBoardsChatAction(BoardService boards) {
        this.boards = boards;
    }

    @Override
    public String id() {
        return "boards.mine";
    }

    @Override
    public String title() {
        return "Мои доски";
    }

    @Override
    public int order() {
        return 60;
    }

    @Override
    public boolean availableTo(ChatUser user) {
        return user.isStudent();
    }

    @Override
    public ChatStep start(ChatUser user) {
        List<MyBoardView> mine = boards.studentBoards(user.id());
        if (mine.isEmpty()) {
            return ChatStep.done("Досок пока нет.");
        }
        ChatReply reply = ChatReply.of("Ваши доски:");
        for (MyBoardView board : mine.subList(0, Math.min(mine.size(), ChatKit.MAX_BUTTONS - 1))) {
            String label = board.groupName() == null ? board.title() : board.title() + " · " + board.groupName();
            reply = reply.row(ChatButton.link(label, board.url()));
        }
        return ChatStep.done(reply);
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }
}
