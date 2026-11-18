package com.pontivus.jig;

import androidx.sqlite.SQLite;
import androidx.sqlite.SQLiteConnection;
import androidx.sqlite.SQLiteStatement;
import androidx.sqlite.driver.bundled.BundledSQLiteDriver;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "JigSqlite")
public final class JigSqlitePlugin extends Plugin {
    private final Object connectionLock = new Object();
    private SQLiteConnection connection = null;

    private File privateDatabaseFile(String relativePath) throws IOException {
        if (relativePath == null || relativePath.isBlank()) {
            throw new IOException("SQLite path is required");
        }
        File root = getContext().getFilesDir().getCanonicalFile();
        File target = new File(root, relativePath).getCanonicalFile();
        if (!target.toPath().startsWith(root.toPath())) {
            throw new IOException("SQLite path escapes app-private storage");
        }
        return target;
    }

    private SQLiteConnection requireConnection() {
        if (connection == null) {
            throw new IllegalStateException("SQLite connection is not open");
        }
        return connection;
    }

    private static void bind(
        SQLiteStatement statement,
        JSArray bindings
    ) throws JSONException {
        for (int offset = 0; offset < bindings.length(); offset += 1) {
            int index = offset + 1;
            Object value = bindings.get(offset);
            if (value == null || value == JSONObject.NULL) {
                statement.bindNull(index);
            } else if (value instanceof String) {
                statement.bindText(index, (String) value);
            } else if (value instanceof Integer) {
                statement.bindLong(index, ((Integer) value).longValue());
            } else if (value instanceof Long) {
                statement.bindLong(index, (Long) value);
            } else if (value instanceof Double) {
                statement.bindDouble(index, (Double) value);
            } else if (value instanceof Float) {
                statement.bindDouble(index, ((Float) value).doubleValue());
            } else {
                throw new IllegalArgumentException(
                    "Unsupported SQLite binding type at index " + index
                );
            }
        }
    }

    private static void exhaust(
        SQLiteConnection database,
        String sql,
        JSArray bindings
    ) throws JSONException {
        try (SQLiteStatement statement = database.prepare(sql)) {
            bind(statement, bindings);
            while (statement.step()) {
                // execute() deliberately discards result rows.
            }
        }
    }

    private static JSObject executionMetadata(
        SQLiteConnection database,
        boolean includeLastInsertRowId
    ) {
        try (
            SQLiteStatement statement = database.prepare(
                "SELECT changes() AS changes, last_insert_rowid() AS last_insert_rowid"
            )
        ) {
            if (!statement.step()) {
                throw new IllegalStateException(
                    "SQLite did not return execution metadata"
                );
            }
            JSObject result = new JSObject();
            result.put("changes", statement.getLong(0));
            result.put(
                "last_insert_rowid",
                includeLastInsertRowId
                    ? statement.getLong(1)
                    : JSONObject.NULL
            );
            return result;
        }
    }

    private static boolean isInsertStatement(String sql) {
        String normalized = sql.stripLeading().toUpperCase();
        return normalized.startsWith("INSERT ") ||
            normalized.startsWith("REPLACE ");
    }

    @PluginMethod
    public void open(PluginCall call) {
        String relativePath = call.getString("path");
        Boolean create = call.getBoolean("create", false);
        synchronized (connectionLock) {
            try {
                if (connection != null) {
                    call.reject("SQLite connection is already open");
                    return;
                }
                File databaseFile = privateDatabaseFile(relativePath);
                if (!Boolean.TRUE.equals(create) && !databaseFile.isFile()) {
                    call.reject("SQLite database does not exist");
                    return;
                }
                File parent = databaseFile.getParentFile();
                if (
                    Boolean.TRUE.equals(create) &&
                    parent != null &&
                    !parent.isDirectory() &&
                    !parent.mkdirs()
                ) {
                    call.reject("Unable to create SQLite parent directory");
                    return;
                }
                connection = new BundledSQLiteDriver().open(
                    databaseFile.getAbsolutePath()
                );
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to open SQLite database", error);
            }
        }
    }

    @PluginMethod
    public void execute(PluginCall call) {
        String sql = call.getString("sql");
        JSArray bindings = call.getArray("bindings");
        if (bindings == null) {
            bindings = new JSArray();
        }
        if (sql == null || sql.isBlank()) {
            call.reject("SQL is required");
            return;
        }

        synchronized (connectionLock) {
            try {
                SQLiteConnection database = requireConnection();
                exhaust(database, sql, bindings);
                call.resolve(
                    executionMetadata(database, isInsertStatement(sql))
                );
            } catch (Exception error) {
                call.reject("SQLite execute failed", error);
            }
        }
    }

    @PluginMethod
    public void query(PluginCall call) {
        String sql = call.getString("sql");
        JSArray bindings = call.getArray("bindings");
        if (bindings == null) {
            bindings = new JSArray();
        }
        if (sql == null || sql.isBlank()) {
            call.reject("SQL is required");
            return;
        }

        synchronized (connectionLock) {
            try {
                SQLiteConnection database = requireConnection();
                JSArray rows = new JSArray();
                try (SQLiteStatement statement = database.prepare(sql)) {
                    bind(statement, bindings);
                    while (statement.step()) {
                        JSObject row = new JSObject();
                        for (
                            int column = 0;
                            column < statement.getColumnCount();
                            column += 1
                        ) {
                            String name = statement.getColumnName(column);
                            int type = statement.getColumnType(column);
                            switch (type) {
                                case SQLite.SQLITE_DATA_NULL:
                                    row.put(name, JSONObject.NULL);
                                    break;
                                case SQLite.SQLITE_DATA_INTEGER:
                                    row.put(name, statement.getLong(column));
                                    break;
                                case SQLite.SQLITE_DATA_FLOAT:
                                    row.put(name, statement.getDouble(column));
                                    break;
                                case SQLite.SQLITE_DATA_TEXT:
                                    row.put(name, statement.getText(column));
                                    break;
                                case SQLite.SQLITE_DATA_BLOB:
                                    throw new IllegalStateException(
                                        "BLOB columns are outside JigSqlConnection"
                                    );
                                default:
                                    throw new IllegalStateException(
                                        "Unknown SQLite column type " + type
                                    );
                            }
                        }
                        rows.put(row);
                    }
                }
                JSObject result = new JSObject();
                result.put("rows", rows);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("SQLite query failed", error);
            }
        }
    }

    private void transactionCommand(
        PluginCall call,
        String sql,
        String failureMessage
    ) {
        synchronized (connectionLock) {
            try {
                exhaust(requireConnection(), sql, new JSArray());
                call.resolve();
            } catch (Exception error) {
                call.reject(failureMessage, error);
            }
        }
    }

    @PluginMethod
    public void begin(PluginCall call) {
        transactionCommand(
            call,
            "BEGIN IMMEDIATE",
            "Unable to begin SQLite transaction"
        );
    }

    @PluginMethod
    public void commit(PluginCall call) {
        transactionCommand(
            call,
            "COMMIT",
            "Unable to commit SQLite transaction"
        );
    }

    @PluginMethod
    public void rollback(PluginCall call) {
        transactionCommand(
            call,
            "ROLLBACK",
            "Unable to roll back SQLite transaction"
        );
    }

    @PluginMethod
    public void close(PluginCall call) {
        synchronized (connectionLock) {
            try {
                if (connection != null) {
                    connection.close();
                    connection = null;
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to close SQLite database", error);
            }
        }
    }
}
