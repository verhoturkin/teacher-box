package ru.teacherbox.billing.application;

import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.GroupPrice;
import ru.teacherbox.billing.persistence.GroupPriceRepository;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.shared.error.NotFoundException;
import ru.teacherbox.shared.money.Money;

/** Lesson prices of groups (ADR-0011). */
@Service
public class GroupPriceService {

    /** @param lessonPrice minor units */
    public record GroupPriceView(UUID groupId, long lessonPrice) {

        static GroupPriceView of(GroupPrice price) {
            return new GroupPriceView(price.groupId(), price.lessonPrice().amountMinor());
        }
    }

    /** Prices of all groups that have one, in minor units of {@code currency}. */
    public record GroupPrices(String currency, List<GroupPriceView> prices) {
    }

    private final GroupPriceRepository prices;
    private final StudentGroups groups;
    private final BillingProperties properties;
    private final BillingCurrency currency;
    private final Clock clock;

    public GroupPriceService(GroupPriceRepository prices, StudentGroups groups, BillingProperties properties,
            BillingCurrency currency, Clock clock) {
        this.prices = prices;
        this.groups = groups;
        this.properties = properties;
        this.currency = currency;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GroupPrices list() {
        return new GroupPrices(currency.code(),
                prices.findAll().stream().map(GroupPriceView::of).toList());
    }

    /** @param price minor units */
    @Transactional
    public GroupPriceView change(UUID groupId, long price) {
        if (groups.findGroup(groupId).isEmpty()) {
            throw new NotFoundException("group.not-found", "Group not found");
        }
        GroupPrice groupPrice = priceOf(groupId);
        groupPrice.change(currency.of(price), clock.instant());
        prices.update(groupPrice);
        return GroupPriceView.of(groupPrice);
    }

    /** Opens the price of a new group with the default lesson price; does nothing if it exists. */
    @Transactional
    public void open(UUID groupId) {
        if (prices.findById(groupId).isEmpty()) {
            prices.insert(GroupPrice.open(groupId, defaultPrice(), clock.instant()));
        }
    }

    /** Price of a lesson of the group; opened with the default price if the group has none yet. */
    @Transactional
    public Money lessonPrice(UUID groupId) {
        return priceOf(groupId).lessonPrice();
    }

    private GroupPrice priceOf(UUID groupId) {
        return prices.findById(groupId).orElseGet(() -> {
            GroupPrice price = GroupPrice.open(groupId, defaultPrice(), clock.instant());
            prices.insert(price);
            return price;
        });
    }

    private Money defaultPrice() {
        return Money.ofDecimal(properties.defaultLessonPrice(), currency.currency());
    }
}
