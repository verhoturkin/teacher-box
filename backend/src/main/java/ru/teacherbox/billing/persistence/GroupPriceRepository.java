package ru.teacherbox.billing.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.billing.domain.GroupPrice;

@Repository
public class GroupPriceRepository {

    private static final String SELECT =
            "select group_id, lesson_price, created_at, updated_at, version from billing.group_prices";

    private final JdbcClient jdbc;
    private final BillingCurrency currency;

    public GroupPriceRepository(JdbcClient jdbc, BillingCurrency currency) {
        this.jdbc = jdbc;
        this.currency = currency;
    }

    public void insert(GroupPrice price) {
        jdbc.sql("""
                insert into billing.group_prices (group_id, lesson_price, created_at, updated_at, version)
                values (:groupId, :lessonPrice, :createdAt, :updatedAt, :version)
                """)
                .param("groupId", price.groupId())
                .param("lessonPrice", price.lessonPrice().amountMinor())
                .param("createdAt", price.createdAt())
                .param("updatedAt", price.updatedAt())
                .param("version", price.version())
                .update();
    }

    public void update(GroupPrice price) {
        int updated = jdbc.sql("""
                update billing.group_prices
                set lesson_price = :lessonPrice, updated_at = :updatedAt, version = version + 1
                where group_id = :groupId and version = :version
                """)
                .param("groupId", price.groupId())
                .param("version", price.version())
                .param("lessonPrice", price.lessonPrice().amountMinor())
                .param("updatedAt", price.updatedAt())
                .update();
        if (updated != 1) {
            throw new OptimisticLockingFailureException("Group price " + price.groupId() + " was modified");
        }
        price.markSaved(price.version() + 1);
    }

    public Optional<GroupPrice> findById(UUID groupId) {
        return jdbc.sql(SELECT + " where group_id = :groupId")
                .param("groupId", groupId)
                .query(this::map)
                .optional();
    }

    public List<GroupPrice> findAll() {
        return jdbc.sql(SELECT).query(this::map).list();
    }

    private GroupPrice map(ResultSet rs, int rowNum) throws SQLException {
        return GroupPrice.restore(
                rs.getObject("group_id", UUID.class),
                currency.of(rs.getLong("lesson_price")),
                rs.getObject("created_at", Instant.class),
                rs.getObject("updated_at", Instant.class),
                rs.getLong("version"));
    }
}
