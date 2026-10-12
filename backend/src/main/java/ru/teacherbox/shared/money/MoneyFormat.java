package ru.teacherbox.shared.money;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;
import ru.teacherbox.shared.i18n.Language;

/** Amounts as people read them: «1 500 ₽», «99,50 ₽», «−200 ₽»; in English «₽1,500», «₽99.50», «−₽200». */
public final class MoneyFormat {

    private static final Locale RUSSIAN = Locale.forLanguageTag("ru");

    private MoneyFormat() {
    }

    /** Plain spaces between thousands, the fraction only when it is not zero. */
    public static String russian(Money money) {
        return format(money, Language.RU);
    }

    /**
     * The fraction only when it is not zero; the symbol of the currency (₽, $, €) in every language, as the
     * interface shows it.
     */
    public static String format(Money money, Language language) {
        BigDecimal amount = money.toDecimal().abs();
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(language.locale());
        if (language == Language.RU) {
            symbols.setGroupingSeparator(' ');
        }
        DecimalFormat format = new DecimalFormat("#,##0", symbols);
        int fractionDigits = amount.stripTrailingZeros().scale() > 0 ? money.currency().getDefaultFractionDigits() : 0;
        format.setMinimumFractionDigits(fractionDigits);
        format.setMaximumFractionDigits(fractionDigits);
        String sign = money.isNegative() ? "−" : "";
        String symbol = money.currency().getSymbol(RUSSIAN);
        return switch (language) {
            case RU -> sign + format.format(amount) + " " + symbol;
            case EN -> sign + symbol + format.format(amount);
        };
    }
}
