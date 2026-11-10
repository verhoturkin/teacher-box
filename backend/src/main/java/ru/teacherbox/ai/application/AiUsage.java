package ru.teacherbox.ai.application;

import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import ru.teacherbox.ai.application.AiViews.AiStatus;
import ru.teacherbox.ai.application.AiViews.FeatureUsage;
import ru.teacherbox.ai.application.AiViews.ModelUsage;
import ru.teacherbox.ai.application.AiViews.RequestPage;
import ru.teacherbox.ai.application.AiViews.RequestView;
import ru.teacherbox.ai.application.AiViews.UsageReport;
import ru.teacherbox.ai.application.LlmClients.ModelClient;
import ru.teacherbox.ai.domain.AiFeature;
import ru.teacherbox.ai.domain.AiModel;
import ru.teacherbox.ai.domain.AiProvider;
import ru.teacherbox.ai.domain.AiRequest;
import ru.teacherbox.ai.domain.RequestStatus;
import ru.teacherbox.ai.domain.TokenBudget;
import ru.teacherbox.ai.persistence.AiRequestRepository;
import ru.teacherbox.ai.persistence.AiRequestRepository.FeatureTotals;
import ru.teacherbox.ai.persistence.AiRequestRepository.ModelTotals;
import ru.teacherbox.ai.persistence.ProviderRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Usage log of the language model and the monthly token limit. */
@Service
public class AiUsage {

    /** Requests on a page of the log. */
    public static final int PAGE_SIZE = 10;

    private final AiRequestRepository requests;
    private final LlmClients llm;
    private final ProviderRepository providers;
    private final InstanceTimeZone timeZone;
    private final Clock clock;

    public AiUsage(AiRequestRepository requests, LlmClients llm, ProviderRepository providers,
            InstanceTimeZone timeZone, Clock clock) {
        this.requests = requests;
        this.llm = llm;
        this.providers = providers;
        this.timeZone = timeZone;
        this.clock = clock;
    }

    public TokenBudget budget() {
        YearMonth month = currentMonth();
        return new TokenBudget(requests.totalTokens(start(month), start(month.plusMonths(1))),
                monthlyTokenLimit());
    }

    /** One limit for all the models (ADR-0057). */
    private long monthlyTokenLimit() {
        return providers.settings().monthlyTokenLimit();
    }

    public AiStatus status() {
        LlmClient client = llm.forDefault().map(ModelClient::client).orElse(null);
        TokenBudget budget = budget();
        return new AiStatus(client != null, client == null ? null : client.provider(),
                client == null ? null : client.model(), budget.used(), budget.limit(), budget.isExhausted());
    }

    /** @param model the model id the provider answered with */
    public void record(AiFeature feature, ModelClient client, String model, RequestStatus status, long inputTokens,
            long outputTokens, long durationMs, @Nullable String error) {
        requests.insert(new AiRequest(Ids.newId(), feature, client.client().provider(), model, client.model().id(),
                status, inputTokens, outputTokens, durationMs, error, clock.instant()));
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
        RequestPage recent = page(from, to, 0);
        return new UsageReport(period.toString(), requests.totalTokens(from, to), monthlyTokenLimit(),
                features, models(requests.totalsByModel(from, to)), recent.items(), recent.hasMore());
    }

    /** The configured models in their order with what they used, then the removed ones (most tokens first). */
    private List<ModelUsage> models(List<ModelTotals> totals) {
        Map<UUID, ModelTotals> byId = new HashMap<>();
        totals.stream().filter(total -> total.modelId() != null).forEach(total -> byId.put(total.modelId(), total));
        List<ModelUsage> models = new ArrayList<>();
        Set<UUID> configured = new HashSet<>();
        for (AiProvider provider : providers.providers()) {
            for (AiModel model : providers.models(provider.id())) {
                configured.add(model.id());
                ModelTotals total = byId.get(model.id());
                if (total != null) {
                    models.add(new ModelUsage(model.id(), model.label(), provider.kind().id(), false,
                            total.requests(), total.inputTokens(), total.outputTokens()));
                }
            }
        }
        totals.stream().filter(total -> total.modelId() == null || !configured.contains(total.modelId()))
                .forEach(total -> models.add(new ModelUsage(total.modelId(), total.model(), total.provider(), true,
                        total.requests(), total.inputTokens(), total.outputTokens())));
        return models;
    }

    /**
     * The request log of a month by pages of {@link #PAGE_SIZE}, newest first.
     *
     * @param month  {@code null} for the current month
     * @param offset how many newer requests are already shown
     */
    public RequestPage requests(@Nullable YearMonth month, int offset) {
        YearMonth period = month == null ? currentMonth() : month;
        return page(start(period), start(period.plusMonths(1)), Math.max(0, offset));
    }

    private RequestPage page(Instant from, Instant to, int offset) {
        List<RequestView> found = requests.findRecent(from, to, offset, PAGE_SIZE + 1).stream()
                .map(RequestView::of)
                .toList();
        return new RequestPage(found.subList(0, Math.min(PAGE_SIZE, found.size())), found.size() > PAGE_SIZE);
    }

    private YearMonth currentMonth() {
        return YearMonth.from(timeZone.today(clock));
    }

    private Instant start(YearMonth month) {
        ZoneId zone = timeZone.zoneId();
        return month.atDay(1).atStartOfDay(zone).toInstant();
    }
}
