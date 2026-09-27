package ru.teacherbox.shared.money;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/** Amounts as people read them: «1 500 ₽», «99,50 ₽», «−200 ₽». */
public final class MoneyFormat {

    private static final Locale RUSSIAN = Locale.forLanguageTag("ru");

    private MoneyFormat() {
    }

    /** Plain spaces between thousands, the fraction only when it is not zero. */
    public static String russian(Money money) {
        BigDecimal amount = money.toDecimal().abs();
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(RUSSIAN);
        symbols.setGroupingSeparator(' ');
        DecimalFormat format = new DecimalFormat("#,##0", symbols);
        int fractionDigits = amount.stripTrailingZeros().scale() > 0 ? money.currency().getDefaultFractionDigits() : 0;
        format.setMinimumFractionDigits(fractionDigits);
        format.setMaximumFractionDigits(fractionDigits);
        String sign = money.isNegative() ? "−" : "";
        return sign + format.format(amount) + " " + money.currency().getSymbol(RUSSIAN);
    }
}
