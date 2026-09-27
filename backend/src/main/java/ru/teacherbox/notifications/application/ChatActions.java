package ru.teacherbox.notifications.application;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatUser;

/** The bot's actions provided by the modules ({@link ChatAction} beans), in menu order. */
@Component
public class ChatActions {

    private static final Pattern ID = Pattern.compile("[a-z0-9.-]{1,32}");

    private final Map<String, ChatAction> byId = new LinkedHashMap<>();

    public ChatActions(ObjectProvider<ChatAction> beans) {
        beans.orderedStream()
                .sorted(Comparator.comparingInt(ChatAction::order).thenComparing(ChatAction::id))
                .forEach(action -> {
                    if (!ID.matcher(action.id()).matches()) {
                        throw new IllegalStateException("Invalid chat action id: " + action.id());
                    }
                    if (byId.putIfAbsent(action.id(), action) != null) {
                        throw new IllegalStateException("Several chat actions with id " + action.id());
                    }
                });
    }

    public List<ChatAction> availableTo(ChatUser user) {
        return byId.values().stream().filter(action -> action.availableTo(user)).toList();
    }

    public Optional<ChatAction> find(String id) {
        return Optional.ofNullable(byId.get(id));
    }
}
