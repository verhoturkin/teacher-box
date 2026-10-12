package ru.teacherbox.platform.backup;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;

/**
 * Leaves the rows of some tables out of the H2 {@code SCRIPT} result (ADR-0037); the tables themselves stay.
 * {@code SCRIPT} writes a table's data after the comment {@code -- n +/- SELECT COUNT(*) FROM S.T;}: its
 * {@code INSERT INTO "S"."T"} batches, each preceded by the parts of the large values it holds
 * ({@code INSERT INTO SYSTEM_LOB_STREAM}). Both are dropped while the current table is left out.
 */
final class BackupDump {

    private static final Pattern TABLE_DATA = Pattern.compile("-- \\d+ \\+/- SELECT COUNT\\(\\*\\) FROM (\\S+);");
    private static final String LOB_PART = "INSERT INTO SYSTEM_LOB_STREAM ";

    private final Set<String> skipped;
    private @Nullable String skippedInsert;

    /** @param skipped tables as {@code schema.table}, in any case */
    BackupDump(Collection<String> skipped) {
        this.skipped = skipped.stream().map(table -> table.toUpperCase(Locale.ROOT)).collect(Collectors.toSet());
    }

    /** Whether the row of the {@code SCRIPT} result goes into the backup; rows are passed in order. */
    boolean keep(String row) {
        Matcher data = TABLE_DATA.matcher(row);
        if (data.matches()) {
            String table = data.group(1).toUpperCase(Locale.ROOT);
            skippedInsert = skipped.contains(table) ? "INSERT INTO " + quoted(table) : null;
            return true;
        }
        return skippedInsert == null || !row.startsWith(LOB_PART) && !row.startsWith(skippedInsert);
    }

    /** {@code S.T} → {@code "S"."T"}, followed by the space or the column list. */
    private static String quoted(String table) {
        int dot = table.indexOf('.');
        return "\"" + table.substring(0, dot) + "\".\"" + table.substring(dot + 1) + "\"";
    }
}
