package ru.teacherbox.billing.application;

import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import ru.teacherbox.identity.api.GroupCreated;

/** A new group gets the default lesson price. */
@Component
class GroupListener {

    private final GroupPriceService prices;

    GroupListener(GroupPriceService prices) {
        this.prices = prices;
    }

    @ApplicationModuleListener
    void on(GroupCreated event) {
        prices.open(event.groupId());
    }
}
