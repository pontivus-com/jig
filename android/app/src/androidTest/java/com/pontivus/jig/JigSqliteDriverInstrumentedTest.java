package com.pontivus.jig;

import static org.junit.Assert.assertEquals;

import androidx.sqlite.SQLiteConnection;
import androidx.sqlite.SQLiteStatement;
import androidx.sqlite.driver.bundled.BundledSQLiteDriver;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class JigSqliteDriverInstrumentedTest {
    private File databaseFile;

    private static void execute(
        SQLiteConnection connection,
        String sql
    ) {
        try (SQLiteStatement statement = connection.prepare(sql)) {
            while (statement.step()) {
                // Statements used by this proof do not return result rows.
            }
        }
    }

    private static String queryTitle(
        SQLiteConnection connection
    ) {
        try (
            SQLiteStatement statement = connection.prepare(
                "SELECT title FROM proof_task WHERE id = 1"
            )
        ) {
            if (!statement.step()) {
                throw new AssertionError("Expected persisted proof row");
            }
            return statement.getText(0);
        }
    }

    @After
    public void cleanUp() {
        if (databaseFile != null) {
            databaseFile.delete();
        }
    }

    @Test
    public void bundledDriverPersistsCommitAndRollbackAcrossReopen() {
        databaseFile = new File(
            InstrumentationRegistry
                .getInstrumentation()
                .getTargetContext()
                .getFilesDir(),
            "jig-sqlite-driver-instrumented.sqlite"
        );
        databaseFile.delete();

        BundledSQLiteDriver driver = new BundledSQLiteDriver();
        SQLiteConnection connection = driver.open(
            databaseFile.getAbsolutePath()
        );
        try {
            execute(
                connection,
                "CREATE TABLE proof_task (" +
                    "id INTEGER PRIMARY KEY, " +
                    "title TEXT NOT NULL" +
                    ")"
            );

            execute(connection, "BEGIN IMMEDIATE");
            try (
                SQLiteStatement insert = connection.prepare(
                    "INSERT INTO proof_task(id, title) VALUES (?, ?)"
                )
            ) {
                insert.bindLong(1, 1L);
                insert.bindText(2, "committed");
                while (insert.step()) {
                    // INSERT has no result rows.
                }
            }
            execute(connection, "COMMIT");
            assertEquals("committed", queryTitle(connection));

            execute(connection, "BEGIN IMMEDIATE");
            try (
                SQLiteStatement update = connection.prepare(
                    "UPDATE proof_task SET title = ? WHERE id = ?"
                )
            ) {
                update.bindText(1, "rolled back");
                update.bindLong(2, 1L);
                while (update.step()) {
                    // UPDATE has no result rows.
                }
            }
            execute(connection, "ROLLBACK");
            assertEquals("committed", queryTitle(connection));
        } finally {
            connection.close();
        }

        SQLiteConnection reopened = driver.open(
            databaseFile.getAbsolutePath()
        );
        try {
            assertEquals("committed", queryTitle(reopened));
        } finally {
            reopened.close();
        }
    }
}
