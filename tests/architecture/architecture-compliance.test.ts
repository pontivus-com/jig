import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function productionSources(
  directory: string,
): readonly [string, string][] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionSources(path);
    }
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) {
      return [];
    }
    if (/jig(?:\.variants|\.css)?\.d\.ts$/.test(entry.name)) {
      return [];
    }
    return [[path, source(path)] as const];
  });
}

const production = [
  ...productionSources("src"),
  ...productionSources("ui/src"),
];

describe("architecture compliance", () => {
  it("keeps the functional core dependency-free from shell and UI", () => {
    for (const [path, content] of production.filter(([path]) =>
      path.startsWith("src/core/"),
    )) {
      expect(content, path).not.toMatch(/from\s+["'][^"']*\/shell\//);
      expect(content, path).not.toMatch(/from\s+["'][^"']*\/ui\//);
      expect(content, path).not.toMatch(
        /bun:sqlite|node:fs|node:path|Bun\.spawn|\bfetch\(|\blocalStorage\b|\bsessionStorage\b/,
      );
    }
  });

  it("keeps browser UI independent from shell implementation modules", () => {
    for (const [path, content] of production.filter(([path]) =>
      path.startsWith("ui/src/"),
    )) {
      expect(content, path).not.toMatch(
        /from\s+["'][^"']*\/src\/shell\//,
      );
      expect(content, path).not.toMatch(/bun:sqlite|Bun\.spawn/);
    }
  });

  it("rejects architecture-inflating abstractions and unsafe domain double casts", () => {
    for (const [path, content] of production) {
      expect(content, path).not.toMatch(/\bas\s+unknown\s+as\b/);
      expect(content, path).not.toMatch(
        /\b(?:class|interface|type)\s+\w*(?:Dto|DTO|ViewModel)\b/,
      );
      expect(content, path).not.toMatch(
        /\bclass\s+\w*(?:Service|Repository|Manager)\b/,
      );
    }
  });

  it("keeps one canonical Task model and one protocol-envelope owner", () => {
    const taskOwners = production.filter(([, content]) =>
      /export interface Task\s*\{/.test(content),
    );
    expect(taskOwners.map(([path]) => path)).toEqual(["src/core/task.ts"]);

    for (const typeName of [
      "RepositoryStatus",
      "CanonicalState",
      "CommandResult",
      "ServiceStatus",
      "Diagnostics",
    ]) {
      const owners = production.filter(([, content]) =>
        new RegExp(`export (?:type|interface) ${typeName}\\b`).test(content),
      );
      expect(owners.map(([path]) => path)).toEqual(["src/protocol.ts"]);
    }
  });

  it("keeps v1.0.4 Planner and editor semantics single-owner", () => {
    const app = source("ui/src/app.tsx");
    const planner = source("ui/src/planner.tsx");
    const week = source("ui/src/week.tsx");
    const list = source("ui/src/planner-list.tsx");
    const editor = source("ui/src/task-editor.tsx");

    expect(app).not.toContain("selectedDate");
    expect(planner).not.toContain("selectedDate");
    expect(week).not.toContain("selectedDate");
    expect(list).not.toContain("selectedDate");

    expect(week).toContain("<PlannerTaskList");
    expect(week).not.toContain("<TaskRow");
    expect(week).not.toContain("<SortableTaskRow");

    expect(editor).not.toContain("normalizeTitle");
    expect(editor).not.toContain("normalizeOptionalText");
    expect(editor).not.toContain("function optionalText");
  });

  it("isolates justified third-party assertions to boundary adapters", () => {
    const ui = production.filter(([path]) => path.startsWith("ui/src/"));
    const assertions = ui.flatMap(([path, content]) =>
      content
        .split("\n")
        .map((line, index) => ({ path, line: index + 1, text: line.trim() }))
        .filter(({ text }) => /\sas\s+[A-Z][A-Za-z0-9_<>, |\[\]]+/.test(text)),
    );

    expect(assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "ui/src/dates.ts",
          text: "return value as ISODateString;",
        }),
        expect.objectContaining({
          path: "ui/src/dates.ts",
          text: "return value as ISOTimeString;",
        }),
        expect.objectContaining({
          path: "ui/src/drag.tsx",
          text: "ref={ref as Ref<HTMLDivElement>}",
        }),
        expect.objectContaining({
          path: "ui/src/http.ts",
          text: "return value as Record<string, unknown>;",
        }),
        expect.objectContaining({
          path: "ui/src/http.ts",
          text: "? (payload as Record<string, unknown>)",
        }),
        expect.objectContaining({
          path: "ui/src/task-row.tsx",
          text: "const rowRef = sortable.ref as Ref<HTMLLIElement>;",
        }),
        expect.objectContaining({
          path: "ui/src/task-row.tsx",
          text: "const dragSourceRef = sortable.sourceRef as Ref<HTMLDivElement>;",
        }),
      ]),
    );
    expect(assertions).toHaveLength(7);
  });
});
