package ru.teacherbox.boards.chat;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import ru.teacherbox.boards.application.BoardService;
import ru.teacherbox.boards.application.BoardService.MyBoardView;
import ru.teacherbox.boards.domain.BoardKind;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.portal.Portal;

/**
 * A student: links to their boards and their groups' boards — an Excalidraw board opens in the portal,
 * an external board by its own link.
 */
@Component
class MyBoardsChatAction implements ChatAction {

    private final BoardService boards;
    private final Portal portal;

    MyBoardsChatAction(BoardService boards, Portal portal) {
        this.boards = boards;
        this.portal = portal;
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
    public String icon() {
        return ChatIcons.BOARDS;
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
        int shown = 0;
        for (MyBoardView board : mine) {
            Optional<String> link = link(board);
            if (link.isPresent() && shown < ChatKit.MAX_BUTTONS - 1) {
                String label = board.groupNames().isEmpty() ? board.title()
                        : board.title() + " · " + String.join(", ", board.groupNames());
                reply = reply.row(ChatButton.link(label, link.get()));
                shown++;
            }
        }
        return ChatStep.done(shown == 0 ? ChatReply.of("Доски открываются в личном кабинете портала.") : reply);
    }

    private Optional<String> link(MyBoardView board) {
        return board.kind() == BoardKind.LINK && board.url() != null ? Optional.of(board.url())
                : portal.link("/cabinet/boards/" + board.id());
    }

    @Override
    public ChatStep next(ChatUser user, ChatState state, ChatInput input) {
        return start(user);
    }
}
