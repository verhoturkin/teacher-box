package ru.teacherbox.notifications.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import ru.teacherbox.identity.api.StudentSummary;
import ru.teacherbox.identity.api.UserDirectory;
import ru.teacherbox.notifications.domain.ButtonSet;
import ru.teacherbox.notifications.domain.ChannelLink;
import ru.teacherbox.notifications.domain.ChannelType;
import ru.teacherbox.notifications.domain.ChatDialog;
import ru.teacherbox.notifications.domain.LinkCodes;
import ru.teacherbox.notifications.persistence.ChannelLinkRepository;
import ru.teacherbox.notifications.persistence.ChatRepository;
import ru.teacherbox.shared.chat.ChatAction;
import ru.teacherbox.shared.chat.ChatButton;
import ru.teacherbox.shared.chat.ChatFile;
import ru.teacherbox.shared.chat.ChatIcons;
import ru.teacherbox.shared.chat.ChatInput;
import ru.teacherbox.shared.chat.ChatKit;
import ru.teacherbox.shared.chat.ChatOffer;
import ru.teacherbox.shared.chat.ChatReply;
import ru.teacherbox.shared.chat.ChatState;
import ru.teacherbox.shared.chat.ChatStep;
import ru.teacherbox.shared.chat.ChatSubject;
import ru.teacherbox.shared.chat.ChatUser;
import ru.teacherbox.shared.diagnostics.AuditLog;
import ru.teacherbox.shared.error.DomainException;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.shared.security.Role;

/**
 * Dialogs with the bots (ADR-0013): connecting an account, the menu of the user's actions, the
 * dialog of an action step by step, «Отмена» at any step, buttons under notifications. Only
 * connected accounts get the menu; the role and the language come from {@code identity} (ADR-0036).
 * Transactions are the actions' own: a refused action must not roll back the dialog.
 */
@Service
public class ChatEngine {

    static final Duration DIALOG_TTL = Duration.ofMinutes(30);
    static final Duration BUTTONS_TTL = Duration.ofDays(2);
    static final Duration OFFER_TTL = Duration.ofDays(7);
    static final int MAX_IN_ROW = 5;

    /** Values of the bot's own buttons; they never reach the actions ({@link ru.teacherbox.shared.chat.ChatAction}). */
    static final String OWN = "bot:";
    static final String MENU = OWN + "menu";
    static final String CANCEL = OWN + "cancel";
    static final String SWITCH = OWN + "switch";
    static final String START = OWN + "start:";
    static final String AS = OWN + "as:";

    private static final Logger log = LoggerFactory.getLogger(ChatEngine.class);

    private final ChannelService channels;
    private final ChannelLinkRepository links;
    private final ChatRepository chat;
    private final ChatActions actions;
    private final UserDirectory users;
    private final Portal portal;
    private final Clock clock;

    public ChatEngine(ChannelService channels, ChannelLinkRepository links, ChatRepository chat, ChatActions actions,
            UserDirectory users, Portal portal, Clock clock) {
        this.channels = channels;
        this.links = links;
        this.chat = chat;
        this.actions = actions;
        this.users = users;
        this.portal = portal;
        this.clock = clock;
    }

    /** The chat and whose account it acts for. */
    private record Conversation(ChannelType channel, String externalId, ChatUser user, ChatDialog dialog,
            int accounts) {
    }

    /** Answers a message or a pressed button. */
    public OutgoingMessage handle(ChannelType channel, IncomingMessage message) {
        Instant now = clock.instant();
        ButtonPress press = message.press();
        if (press != null) {
            return pressed(channel, message.externalId(), press.data(), now);
        }
        String text = message.text().strip();
        String command = command(text);
        if (command.equals("/stop") || LinkCodes.find(text).isPresent()) {
            String reply = channels.handleIncoming(channel, message);
            return conversation(channel, message.externalId(), null)
                    .map(conversation -> send(conversation, ChatReply.of(reply), List.of(menuButton(texts(conversation))),
                            null, ChatState.EMPTY, now))
                    .orElseGet(() -> OutgoingMessage.text(reply));
        }
        Optional<OutgoingMessage> blocked = blocked(channel, message.externalId(), null, now);
        if (blocked.isPresent()) {
            return blocked.get();
        }
        Conversation conversation = conversation(channel, message.externalId(), null).orElseThrow();
        IncomingFile file = message.file();
        if (file != null) {
            return file(conversation, file, text, now);
        }
        return switch (command) {
            case "/start", "/menu", "меню", "начать", "menu", "start" -> menu(conversation, null, now);
            case "/cancel", "отмена", "отменить", "cancel" -> cancel(conversation, now);
            case "/help", "помощь", "справка", "help" -> help(conversation, now);
            default -> text(conversation, text, now);
        };
    }

    /**
     * Buttons of an action under a notification about the subject, already sent as button data; empty
     * if no action offers any.
     */
    public List<List<OutgoingButton>> offer(UUID recipientId, ChannelType channel, String externalId,
            ChatSubject subject) {
        Optional<ChatUser> user = user(recipientId);
        if (user.isEmpty() || (user.get().isTeacher() && !chat.teacherActions())) {
            return List.of();
        }
        Instant now = clock.instant();
        for (ChatAction action : actions.availableTo(user.get())) {
            Optional<ChatOffer> offer;
            try {
                offer = action.offer(user.get(), subject);
            } catch (RuntimeException e) {
                log.warn("Chat action {} could not offer buttons for {}", action.id(), subject.type(), e);
                continue;
            }
            if (offer.isPresent() && !offer.get().rows().isEmpty()) {
                return encode(recipientId, channel, externalId, action.id(), offer.get().state(),
                        fit(offer.get().rows(), List.of()), OFFER_TTL, now);
            }
        }
        return List.of();
    }

    private OutgoingMessage text(Conversation conversation, String text, Instant now) {
        Optional<ChatAction> waiting = conversation.dialog().waitingAction(now).flatMap(actions::find);
        if (waiting.isPresent()) {
            ChatState state = conversation.dialog().state();
            return run(conversation, waiting.get(), () -> waiting.get().next(conversation.user(), state,
                    new ChatInput.Text(text)), now);
        }
        return menu(conversation, texts(conversation).notUnderstood(), now);
    }

    /** A file goes to the first action that takes files; any dialog ends. */
    private OutgoingMessage file(Conversation conversation, IncomingFile file, String caption, Instant now) {
        ChatUser user = conversation.user();
        BotMessages t = texts(conversation);
        if (user.isTeacher() && !chat.teacherActions()) {
            chat.saveDialog(conversation.dialog().finished(), now);
            return OutgoingMessage.text(t.teacherOff());
        }
        Optional<ChatAction> taker = actions.availableTo(user).stream()
                .filter(action -> action.takesFiles(user))
                .findFirst();
        if (taker.isEmpty()) {
            return menu(conversation, t.fileNotTaken(), now);
        }
        if (file.size() > ChatFile.MAX_SIZE) {
            return menu(conversation, t.fileTooLarge(), now);
        }
        byte[] content;
        try {
            content = file.download().content();
        } catch (RuntimeException e) {
            log.warn("Could not download a file from {}: {}", conversation.channel(), e.getMessage());
            return menu(conversation, t.fileFailed(), now);
        }
        if (content.length > ChatFile.MAX_SIZE) {
            return menu(conversation, t.fileTooLarge(), now);
        }
        ChatFile received = new ChatFile(file.name(), content, caption);
        return run(conversation, taker.get(), () -> taker.get().received(user, received), now);
    }

    private OutgoingMessage pressed(ChannelType channel, String externalId, String data, Instant now) {
        Optional<ButtonSet.Press> press = ButtonSet.parse(data);
        if (press.isEmpty()) {
            return stale(channel, externalId, now);
        }
        int index = press.get().index();
        Optional<ButtonSet> set = chat.takeButtons(press.get().token(), channel, externalId);
        Optional<String> value = set.flatMap(buttons -> buttons.choice(index, channel, externalId, now));
        if (set.isEmpty() || value.isEmpty()) {
            return stale(channel, externalId, now);
        }
        ButtonSet buttons = set.get();
        String choice = value.get();
        if (choice.startsWith(AS)) {
            return chooseAccount(channel, externalId, choice.substring(AS.length()), now);
        }
        Optional<OutgoingMessage> blocked = blocked(channel, externalId, buttons.recipientId(), now);
        if (blocked.isPresent()) {
            return blocked.get();
        }
        Conversation conversation = conversation(channel, externalId, buttons.recipientId()).orElseThrow();
        if (!choice.startsWith(OWN) && buttons.actionId() != null) {
            Optional<ChatAction> action = actions.find(buttons.actionId());
            if (action.isEmpty()) {
                return menu(conversation, texts(conversation).stale(), now);
            }
            return run(conversation, action.get(), () -> action.get().next(conversation.user(), buttons.state(),
                    new ChatInput.Choice(choice)), now);
        }
        if (choice.startsWith(START)) {
            Optional<ChatAction> action = actions.find(choice.substring(START.length()));
            return action.isEmpty()
                    ? menu(conversation, texts(conversation).stale(), now)
                    : run(conversation, action.get(), () -> action.get().start(conversation.user()), now);
        }
        return switch (choice) {
            case CANCEL -> cancel(conversation, now);
            case SWITCH -> accounts(channel, externalId, now);
            default -> menu(conversation, null, now);
        };
    }

    private OutgoingMessage run(Conversation conversation, ChatAction action, Supplier<ChatStep> step, Instant now) {
        ChatUser user = conversation.user();
        BotMessages t = texts(conversation);
        if (user.isTeacher() && !chat.teacherActions()) {
            chat.saveDialog(conversation.dialog().finished(), now);
            return OutgoingMessage.text(t.teacherOff());
        }
        if (!action.availableTo(user)) {
            return menu(conversation, t.stale(), now);
        }
        ChatStep result;
        try {
            result = step.get();
        } catch (DomainException e) {
            log.info("Chat action {} refused: {}", action.id(), e.getMessage());
            return failed(conversation, now);
        } catch (RuntimeException e) {
            log.warn("Chat action {} failed", action.id(), e);
            return failed(conversation, now);
        }
        return switch (result) {
            case ChatStep.Ask ask -> {
                chat.saveDialog(conversation.dialog().waitFor(action.id(), ask.state(), now.plus(DIALOG_TTL)), now);
                yield send(conversation, ask.reply(),
                        List.of(ChatButton.choice(ChatIcons.with(ChatIcons.CANCEL, t.cancel()), CANCEL)), action.id(),
                        ask.state(), now);
            }
            case ChatStep.Done done -> {
                chat.saveDialog(conversation.dialog().finished(), now);
                if (done.audit() != null && user.isTeacher()) {
                    AuditLog.bot(user.id(), conversation.channel().name(), action.id() + " " + done.audit());
                }
                yield send(conversation, done.reply(), List.of(menuButton(t)), null, ChatState.EMPTY, now);
            }
        };
    }

    private OutgoingMessage menu(Conversation conversation, @Nullable String prefix, Instant now) {
        chat.saveDialog(conversation.dialog().finished(), now);
        ChatUser user = conversation.user();
        BotMessages t = texts(conversation);
        if (user.isTeacher() && !chat.teacherActions()) {
            return OutgoingMessage.text(prefix == null ? t.teacherOff() : prefix + "\n" + t.teacherOff());
        }
        List<ChatAction> available = actions.availableTo(user);
        String question = available.isEmpty() ? t.nothingYet() : user.isTeacher() ? t.menuTeacher() : t.menuStudent();
        List<List<ChatButton>> rows = new ArrayList<>();
        for (int i = 0; i < available.size(); i += 2) {
            rows.add(available.subList(i, Math.min(i + 2, available.size())).stream()
                    .map(action -> ChatButton.choice(ChatIcons.with(action.icon(), action.title(user.language())),
                            START + action.id()))
                    .toList());
        }
        if (conversation.accounts() > 1) {
            rows.add(List.of(ChatButton.choice(ChatIcons.with(ChatIcons.SWITCH_ACCOUNT, t.switchAccount()), SWITCH)));
        }
        ChatReply reply = new ChatReply(prefix == null ? question : prefix + "\n" + question, rows);
        return send(conversation, reply, List.of(), null, ChatState.EMPTY, now);
    }

    private OutgoingMessage cancel(Conversation conversation, Instant now) {
        return menu(conversation, texts(conversation).cancelled(), now);
    }

    private OutgoingMessage help(Conversation conversation, Instant now) {
        chat.saveDialog(conversation.dialog().finished(), now);
        ChatUser user = conversation.user();
        BotMessages t = texts(conversation);
        StringBuilder text = new StringBuilder();
        List<ChatAction> available = user.isTeacher() && !chat.teacherActions() ? List.of() : actions.availableTo(user);
        if (available.isEmpty()) {
            text.append(t.nothingYet());
        } else {
            text.append(t.canDo());
            available.forEach(action -> text.append("\n• ").append(action.title(user.language())));
        }
        text.append("\n\n").append(t.commandsHelp());
        portal.link(user.isTeacher() ? "/teacher/help/bot" : "/cabinet/help/bot")
                .ifPresent(help -> text.append("\n\n").append(t.helpLink(help)));
        return send(conversation, ChatReply.of(text.toString()), List.of(menuButton(t)), null, ChatState.EMPTY, now);
    }

    private OutgoingMessage failed(Conversation conversation, Instant now) {
        chat.saveDialog(conversation.dialog().finished(), now);
        BotMessages t = texts(conversation);
        return send(conversation, ChatReply.of(t.failed()), List.of(menuButton(t)), null, ChatState.EMPTY, now);
    }

    private OutgoingMessage stale(ChannelType channel, String externalId, Instant now) {
        Optional<OutgoingMessage> blocked = blocked(channel, externalId, null, now);
        if (blocked.isPresent()) {
            return blocked.get();
        }
        return conversation(channel, externalId, null)
                .map(conversation -> menu(conversation, texts(conversation).stale(), now))
                .orElseGet(() -> OutgoingMessage.text(BotMessages.of(teacherLanguage()).stale()));
    }

    /** The answer when the chat cannot act: not connected, several accounts to choose from, no access. */
    private Optional<OutgoingMessage> blocked(ChannelType channel, String externalId, @Nullable UUID pressedFor,
            Instant now) {
        List<ChannelLink> linked = links.findByExternal(channel, externalId);
        if (linked.isEmpty()) {
            return Optional.of(OutgoingMessage.text(channels.howToConnect()));
        }
        UUID recipient = pressedFor != null ? pressedFor : recipient(channel, externalId, linked);
        if (recipient == null) {
            return Optional.of(accounts(channel, externalId, now));
        }
        if (linked.stream().noneMatch(link -> link.recipientId().equals(recipient))) {
            return Optional.of(OutgoingMessage.text(BotMessages.of(users.language(linked.getFirst().recipientId()))
                    .stale()));
        }
        return user(recipient).isEmpty()
                ? Optional.of(OutgoingMessage.text(BotMessages.of(users.language(recipient)).noAccess()))
                : Optional.empty();
    }

    private Optional<Conversation> conversation(ChannelType channel, String externalId, @Nullable UUID pressedFor) {
        List<ChannelLink> linked = links.findByExternal(channel, externalId);
        UUID recipient = pressedFor != null ? pressedFor : recipient(channel, externalId, linked);
        if (recipient == null || linked.stream().noneMatch(link -> link.recipientId().equals(recipient))) {
            return Optional.empty();
        }
        ChatDialog dialog = chat.findDialog(channel, externalId).orElseGet(() -> ChatDialog.idle(channel, externalId));
        if (!recipient.equals(dialog.recipientId())) {
            dialog = dialog.finished().actingFor(recipient);
        }
        ChatDialog current = dialog;
        return user(recipient).map(user -> new Conversation(channel, externalId, user, current, linked.size()));
    }

    /** The account the chat acts for: the only one, or the one chosen earlier. */
    private @Nullable UUID recipient(ChannelType channel, String externalId, List<ChannelLink> linked) {
        if (linked.size() == 1) {
            return linked.getFirst().recipientId();
        }
        UUID chosen = chat.findDialog(channel, externalId).map(ChatDialog::recipientId).orElse(null);
        return linked.stream().anyMatch(link -> link.recipientId().equals(chosen)) ? chosen : null;
    }

    private OutgoingMessage accounts(ChannelType channel, String externalId, Instant now) {
        List<ChannelLink> linked = links.findByExternal(channel, externalId);
        if (linked.isEmpty()) {
            return OutgoingMessage.text(channels.howToConnect());
        }
        ChatDialog dialog = chat.findDialog(channel, externalId).orElseGet(() -> ChatDialog.idle(channel, externalId));
        chat.saveDialog(dialog.finished().actingFor(null), now);
        // whose account is not chosen yet: the question is in the language of the first one
        BotMessages t = BotMessages.of(users.language(linked.getFirst().recipientId()));
        List<List<ChatButton>> rows = linked.stream()
                .map(link -> List.of(ChatButton.choice(name(link.recipientId(), t), AS + link.recipientId())))
                .toList();
        return new OutgoingMessage(t.chooseAccount(), encode(linked.getFirst().recipientId(), channel, externalId, null,
                ChatState.EMPTY, fit(rows, List.of()), BUTTONS_TTL, now));
    }

    private OutgoingMessage chooseAccount(ChannelType channel, String externalId, String recipient, Instant now) {
        List<ChannelLink> linked = links.findByExternal(channel, externalId);
        Optional<ChannelLink> chosen = linked.stream()
                .filter(link -> link.recipientId().toString().equals(recipient))
                .findFirst();
        if (chosen.isEmpty()) {
            return linked.isEmpty() ? OutgoingMessage.text(channels.howToConnect()) : accounts(channel, externalId, now);
        }
        ChatDialog dialog = chat.findDialog(channel, externalId).orElseGet(() -> ChatDialog.idle(channel, externalId));
        chat.saveDialog(dialog.finished().actingFor(chosen.get().recipientId()), now);
        Optional<Conversation> conversation = conversation(channel, externalId, chosen.get().recipientId());
        BotMessages t = BotMessages.of(users.language(chosen.get().recipientId()));
        return conversation.isEmpty()
                ? OutgoingMessage.text(t.noAccess())
                : menu(conversation.get(), t.actingFor(name(chosen.get().recipientId(), t)), now);
    }

    /** The teacher, or a current student, in the language of their account; nobody else may use the bot. */
    private Optional<ChatUser> user(UUID recipientId) {
        if (recipientId.equals(users.teacherId())) {
            return Optional.of(new ChatUser(recipientId, Role.TEACHER, users.language(recipientId)));
        }
        return users.findStudent(recipientId)
                .filter(StudentSummary::isCurrent)
                .map(student -> new ChatUser(recipientId, Role.STUDENT, users.language(recipientId)));
    }

    private String name(UUID recipientId, BotMessages t) {
        if (recipientId.equals(users.teacherId())) {
            return t.teacher();
        }
        return users.findStudent(recipientId).map(StudentSummary::displayName).orElse(t.unknownStudent());
    }

    private static BotMessages texts(Conversation conversation) {
        return BotMessages.of(conversation.user().language());
    }

    private Language teacherLanguage() {
        return users.language(users.teacherId());
    }

    /** The bot's commands in the messenger's menu, in the given language. */
    public static List<BotCommand> commands(Language language) {
        return BotMessages.of(language).commands();
    }

    /** The reply with the bot's own buttons below it ({@code own}); the choices go to {@code actionId}. */
    private OutgoingMessage send(Conversation conversation, ChatReply reply, List<ChatButton> own,
            @Nullable String actionId, ChatState state, Instant now) {
        return new OutgoingMessage(reply.text(), encode(conversation.user().id(), conversation.channel(),
                conversation.externalId(), actionId, state, fit(reply.rows(), own), BUTTONS_TTL, now));
    }

    /** Keeps the choices of the buttons on the server and gives the buttons their data. */
    private List<List<OutgoingButton>> encode(UUID recipientId, ChannelType channel, String externalId,
            @Nullable String actionId, ChatState state, List<List<ChatButton>> rows, Duration ttl, Instant now) {
        List<String> choices = new ArrayList<>();
        String token = ButtonSet.newToken();
        List<List<OutgoingButton>> encoded = new ArrayList<>();
        for (List<ChatButton> row : rows) {
            List<OutgoingButton> buttons = new ArrayList<>();
            for (ChatButton button : row) {
                if (button.value() != null) {
                    buttons.add(new OutgoingButton(button.label(), token + ":" + choices.size(), null));
                    choices.add(button.value());
                } else {
                    buttons.add(new OutgoingButton(button.label(), null, button.url()));
                }
            }
            encoded.add(buttons);
        }
        if (!choices.isEmpty()) {
            chat.insertButtons(new ButtonSet(token, recipientId, channel, externalId, actionId, state, choices, now,
                    now.plus(ttl)));
        }
        return encoded;
    }

    /**
     * Rows of at most {@value #MAX_IN_ROW} buttons and at most {@value ChatKit#MAX_BUTTONS} buttons in
     * all (VK limits), keeping the bot's own row.
     */
    static List<List<ChatButton>> fit(List<List<ChatButton>> rows, List<ChatButton> own) {
        List<List<ChatButton>> fitted = new ArrayList<>();
        int budget = ChatKit.MAX_BUTTONS - own.size();
        for (List<ChatButton> row : rows) {
            for (int from = 0; from < row.size() && budget > 0; from += MAX_IN_ROW) {
                List<ChatButton> part = row.subList(from, Math.min(from + MAX_IN_ROW, row.size()));
                List<ChatButton> taken = part.subList(0, Math.min(part.size(), budget));
                fitted.add(List.copyOf(taken));
                budget -= taken.size();
            }
        }
        if (!own.isEmpty()) {
            fitted.add(List.copyOf(own));
        }
        return fitted;
    }

    private static ChatButton menuButton(BotMessages t) {
        return ChatButton.choice(ChatIcons.with(ChatIcons.MENU, t.menu()), MENU);
    }

    /** {@code /menu@school_bot} → {@code /menu}; plain words in lower case. */
    static String command(String text) {
        String lower = text.strip().toLowerCase(Locale.ROOT);
        int space = lower.indexOf(' ');
        String first = space < 0 ? lower : lower.substring(0, space);
        if (first.startsWith("/")) {
            int at = first.indexOf('@');
            return at < 0 ? first : first.substring(0, at);
        }
        return lower.toLowerCase(Locale.forLanguageTag("ru"));
    }
}
