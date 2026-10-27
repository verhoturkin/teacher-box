package ru.teacherbox.billing.web;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Currency;
import java.util.StringJoiner;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.billing.application.BillingViews.Operation;
import ru.teacherbox.billing.application.BillingViews.Operations;
import ru.teacherbox.billing.domain.LessonStatus;

/** The journal as a spreadsheet-friendly CSV: UTF-8 with a BOM, {@code ;} separator, decimal comma. */
final class OperationsCsv {

    private static final String BOM = "﻿";
    private static final String HEADER = "Дата;Студент;Тип;Сумма;Комментарий;Отменено";

    private OperationsCsv() {
    }

    static byte[] of(Operations journal) {
        int digits = Currency.getInstance(journal.currency()).getDefaultFractionDigits();
        StringBuilder csv = new StringBuilder(BOM).append(HEADER).append("\r\n");
        for (Operation row : journal.operations()) {
            StringJoiner line = new StringJoiner(";");
            line.add(row.date().toString());
            line.add(escape(row.studentName()));
            line.add(kind(row));
            line.add(amount(row.amount(), digits));
            line.add(escape(row.note()));
            line.add(row.voided() ? "да" : "нет");
            csv.append(line).append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String kind(Operation row) {
        return switch (row.kind()) {
            case PAYMENT -> "Оплата";
            case LESSON -> "Урок";
            case ABSENCE -> row.status() == LessonStatus.CANCELLED ? "Отмена" : "Пропуск";
        };
    }

    private static String amount(long minor, int digits) {
        return BigDecimal.valueOf(minor, digits).setScale(digits, RoundingMode.UNNECESSARY).toPlainString()
                .replace('.', ',');
    }

    /** Quotes a field holding the separator, a quote or a line break; neutralises spreadsheet formulas. */
    private static String escape(@Nullable String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        String text = switch (value.charAt(0)) {
            case '=', '+', '-', '@' -> "'" + value;
            default -> value;
        };
        if (text.contains(";") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }
}
