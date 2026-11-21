import { describe, expect, it } from "vitest";
import {
  createJigSqlConnection,
  type NativeJigSqlitePlugin,
} from "../../ui/src/native/jig-sqlite";

function pluginFixture(
  overrides: Partial<NativeJigSqlitePlugin> = {},
): NativeJigSqlitePlugin {
  return {
    open: async () => undefined,
    execute: async () => ({
      changes: 1,
      last_insert_rowid: 7,
    }),
    query: async () => ({
      rows: [
        {
          id: "row-1",
          count: 2,
          optional: null,
        },
      ],
    }),
    begin: async () => undefined,
    commit: async () => undefined,
    rollback: async () => undefined,
    close: async () => undefined,
    ...overrides,
  };
}

describe("Android JigSqlite TypeScript boundary", () => {
  it("adapts native execution/query values to JigSqlConnection exactly", async () => {
    const calls: string[] = [];
    const plugin = pluginFixture({
      execute: async ({ sql, bindings }) => {
        calls.push(`execute:${sql}:${bindings.join(",")}`);
        return {
          changes: 2,
          last_insert_rowid: 11,
        };
      },
      query: async ({ sql, bindings }) => {
        calls.push(`query:${sql}:${bindings.join(",")}`);
        return {
          rows: [
            {
              title: "Task",
              position: 0,
              completed_at: null,
            },
          ],
        };
      },
      begin: async () => {
        calls.push("begin");
      },
      commit: async () => {
        calls.push("commit");
      },
      rollback: async () => {
        calls.push("rollback");
      },
      close: async () => {
        calls.push("close");
      },
    });
    const connection = createJigSqlConnection(plugin);

    await expect(
      connection.execute("UPDATE task SET title = ? WHERE id = ?", [
        "Changed",
        "task-id",
      ]),
    ).resolves.toStrictEqual({
      changes: 2,
      last_insert_rowid: 11,
    });
    await expect(
      connection.query("SELECT title, position, completed_at FROM task WHERE id = ?", [
        "task-id",
      ]),
    ).resolves.toStrictEqual([
      {
        title: "Task",
        position: 0,
        completed_at: null,
      },
    ]);

    await connection.begin();
    await connection.commit();
    await connection.rollback();
    await connection.close();

    expect(calls).toEqual([
      "execute:UPDATE task SET title = ? WHERE id = ?:Changed,task-id",
      "query:SELECT title, position, completed_at FROM task WHERE id = ?:task-id",
      "begin",
      "commit",
      "rollback",
      "close",
    ]);
  });

  it("rejects native values outside the shared SQL boundary", async () => {
    const invalidExecution = createJigSqlConnection(
      pluginFixture({
        execute: async () => ({
          changes: "1",
          last_insert_rowid: null,
        }),
      }),
    );
    await expect(
      invalidExecution.execute("DELETE FROM task"),
    ).rejects.toThrow(/invalid change count/);

    const invalidQuery = createJigSqlConnection(
      pluginFixture({
        query: async () => ({
          rows: [
            {
              unsupported: {
                nested: true,
              },
            },
          ],
        }),
      }),
    );
    await expect(
      invalidQuery.query("SELECT 1"),
    ).rejects.toThrow(/unsupported value/);
  });

  it("does not reinterpret native transaction failures", async () => {
    const failure = new Error("native rollback failure");
    const connection = createJigSqlConnection(
      pluginFixture({
        rollback: async () => {
          throw failure;
        },
      }),
    );

    await expect(connection.rollback()).rejects.toBe(failure);
  });
});
