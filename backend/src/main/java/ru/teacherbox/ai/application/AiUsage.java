package ru.teacherbox.ai.application;

import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import ru.teacherbox.ai.application.AiViews.AiStatus;
import ru.teacherbox.ai.application.AiViews.FeatureUsage;
import ru.teacherbox.ai.application.AiViews.RequestView;
import ru.teacherbox.ai.application.AiViews.UsageReport;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.domain.TokenBudget;
import ru.teacherbox.ai.persistence.AiRequestRepository;
import ru.teacherbox.ai.persistence.AiRequestRepository.FeatureTotals;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Usage log of the language model and the monthly token limit. */
@Service
public class AiUsage {

    static final int RECENT_REQUESTS = 50;

    private final AiRequestRepository requests;
    private final ObjectProvider<LlmClient> llm;
    private final AiProperties properties;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    public AiUsage(AiRequestRepository requests, ObjectProvider<LlmClient> llm, AiProperties properties,
            InstanceTimeZone timeZone, Clock clock) {
        this.requests = requests;
        this.llm = llm;
        this.properties = properties;
        this.timeZone = timeZone;
        this.clock = clock;
    }

    public TokenBudget budget() {
        YearMonth month = currentMonth();
        return new TokenBudget(requests.totalTokens(start(month), start(month.plusMonths(1))),
                properties.monthlyTokenLimit());
    }

    public AiStatus status() {
        LlmClient client = llm.getIfAvailable();
        TokenBudget budget = budget();
        return new AiStatus(client != null, client == null ? null : client.provider(),
                client == null ? null : client.model(), budget.used(), budget.limit(), budget.isExhausted());
    }

    public void record(AiFeature feature, LlmClient client, String model, RequestStatus status, long inputTokens,
            long outputTokens, long durationMs, @Nullable String error) {
        requests.insert(new AiRequest(Ids.newId(), feature, client.provider(), model, status, inputTokens,
                outputTokens, durationMs, error, clock.instant()));
    }

    /** @param month {@code null} for the current month */
    public UsageReport report(@Nullable YearMonth month) {
        YearMonth period = month == null ? currentMonth() : month;
        Instant from = start(period);
        Instant to = start(period.plusMonths(1));
        Map<AiFeature, FeatureTotals> totals = requests.totalsByFeature(from, to);
        List<FeatureUsage> features = Arrays.stream(AiFeature.values())
                .map(feature -> {
                    FeatureTotals total = totals.getOrDefault(feature, new FeatureTotals(0, 0, 0));
                    return new FeatureUsage(feature, total.requests(), total.inputTokens(), total.outputTokens());
                })
                .toList();
        List<RequestView> recent = requests.findRecent(from, to, RECENT_REQUESTS).stream()
                .map(RequestView::of)
                .toList();
        return new UsageReport(period.toString(), requests.totalTokens(from, to), properties.monthlyTokenLimit(),
                features, recent);
    }

    private YearMonth currentMonth() {
        return YearMonth.from(timeZone.today(clock));
    }

    private Instant start(YearMonth month) {
        ZoneId zone = timeZone.zoneId();
        return month.atDay(1).atStartOfDay(zone).toInstant();
    }
}
