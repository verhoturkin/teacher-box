package ru.teacherbox.shared.persistence;

import java.lang.reflect.Constructor;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.BeanUtils;
import org.springframework.core.convert.support.DefaultConversionService;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.JdbcUtils;
import org.springframework.util.ReflectionUtils;

/**
 * Reads a flat record (or a class with one constructor) from a row: a component {@code studentId} is
 * the column {@code student_id} or {@code studentId}. Columns are matched to components once, on the
 * first row, and values are then read by index. Unlike {@code query(Record.class)} and
 * {@code DataClassRowMapper} no lookup by a wrong name is made, so H2 throws and logs nothing per
 * property (stage 419). A component without a column fails fast.
 */
public final class RecordRowMapper<T> implements RowMapper<T> {

    private static final DefaultConversionService CONVERSION = new DefaultConversionService();

    private final Class<T> type;
    private final Constructor<T> constructor;
    private final String[] names;
    private int @Nullable [] columns;

    private RecordRowMapper(Class<T> type) {
        this.type = type;
        this.constructor = BeanUtils.getResolvableConstructor(type);
        ReflectionUtils.makeAccessible(constructor);
        this.names = BeanUtils.getParameterNames(constructor);
    }

    public static <T> RecordRowMapper<T> of(Class<T> type) {
        return new RecordRowMapper<>(type);
    }

    @Override
    public T mapRow(ResultSet rs, int rowNum) throws SQLException {
        int[] index = columns;
        if (index == null) {
            index = resolve(rs.getMetaData());
            columns = index;
        }
        Class<?>[] types = constructor.getParameterTypes();
        Object[] args = new Object[types.length];
        for (int i = 0; i < types.length; i++) {
            args[i] = convert(JdbcUtils.getResultSetValue(rs, index[i], types[i]), types[i]);
        }
        return BeanUtils.instantiateClass(constructor, args);
    }

    private int[] resolve(ResultSetMetaData meta) throws SQLException {
        Map<String, Integer> byName = new HashMap<>();
        for (int i = 1; i <= meta.getColumnCount(); i++) {
            byName.putIfAbsent(normalize(JdbcUtils.lookupColumnName(meta, i)), i);
        }
        int[] index = new int[names.length];
        for (int i = 0; i < names.length; i++) {
            Integer column = byName.get(normalize(names[i]));
            if (column == null) {
                throw new IllegalStateException(
                        type.getSimpleName() + "." + names[i] + " has no column among " + byName.keySet());
            }
            index[i] = column;
        }
        return index;
    }

    private static String normalize(String name) {
        return name.replace("_", "").toLowerCase(Locale.ROOT);
    }

    private static @Nullable Object convert(@Nullable Object value, Class<?> target) {
        if (value == null) {
            return target == boolean.class ? Boolean.FALSE : target.isPrimitive() ? CONVERSION.convert(0, target) : null;
        }
        return target.isInstance(value) || target.isPrimitive() ? value : CONVERSION.convert(value, target);
    }
}
