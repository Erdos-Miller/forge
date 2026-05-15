import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  TaskParseError,
  createTaskFileContents,
  loadTasks,
  parseTaskFile,
  validateTask,
} from "../src";

const repoRoot = path.resolve(import.meta.dir, "../../..");

describe("loadTasks", () => {
  test("loads the bootstrap task files", async () => {
    const tasks = await loadTasks(repoRoot);

    expect(tasks.length).toBeGreaterThanOrEqual(7);
    expect(tasks.map((task) => task.id)).toContain("F-0002");
    expect(tasks.every((task) => task.sourcePath.endsWith(".md"))).toBe(true);
  });
});

describe("parseTaskFile", () => {
  test("creates task files with canonical markdown sections", () => {
    const contents = createTaskFileContents(
      {
        id: "F-9998",
        title: "Create task",
        priority: "high",
        area: "cli",
        scope: ["packages/cli/**"],
        why: "Task creation should be consistent.",
        success: "A generated task is ready to edit.",
        acceptance: ["It has canonical sections."],
        verification: ["bun test"],
      },
      new Date("2026-05-14T12:00:00Z"),
    );

    const parsed = parseTaskFile("created.md", contents);

    expect(parsed.task.id).toBe("F-9998");
    expect(parsed.task.title).toBe("Create task");
    expect(parsed.task.priority).toBe("high");
    expect(parsed.task.area).toBe("cli");
    expect(parsed.task.scope).toEqual(["packages/cli/**"]);
    expect(parsed.task.body).toContain("## Why");
    expect(parsed.task.body).toContain("## What success looks like");
    expect(parsed.task.body).toContain("## Acceptance Criteria");
    expect(parsed.task.body).toContain("## Verification");
  });

  test("parses frontmatter and preserves the markdown body", () => {
    const source = [
      "---",
      "id: F-9999",
      "title: Example",
      "kind: task",
      "status: open",
      "priority: medium",
      'parent: ""',
      "depends_on: []",
      'claimed_by: ""',
      "scope:",
      "  - packages/**",
      "created_at: 2026-05-14T00:00:00-05:00",
      "updated_at: 2026-05-14T00:00:00-05:00",
      "closed_at: 2026-05-14T01:00:00-05:00",
      "close_reason: Completed",
      "blocked_reason: Waiting",
      "review_reason: Check this",
      "---",
      "",
      "# Example",
      "",
      "Body stays readable.",
      "",
    ].join("\n");

    const parsed = parseTaskFile("example.md", source);

    expect(parsed.task.id).toBe("F-9999");
    expect(parsed.task.depends_on).toEqual([]);
    expect(parsed.task.closed_at).toBe("2026-05-14T06:00:00.000Z");
    expect(parsed.task.close_reason).toBe("Completed");
    expect(parsed.task.blocked_reason).toBe("Waiting");
    expect(parsed.task.review_reason).toBe("Check this");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("reports missing frontmatter with source path context", () => {
    expect(() => parseTaskFile("bad.md", "# Missing")).toThrow(
      /bad\.md: missing YAML frontmatter/,
    );
  });

  test("reports malformed YAML with source path context", () => {
    expect(() => parseTaskFile("bad-yaml.md", "---\nid: [\n---\n")).toThrow(
      /bad-yaml\.md: malformed YAML frontmatter/,
    );
  });
});

describe("validateTask", () => {
  const validTask = {
    id: "F-9999",
    title: "Example",
    kind: "task",
    status: "open",
    priority: "medium",
    parent: "",
    depends_on: [],
    claimed_by: "",
    scope: ["packages/**"],
    created_at: "2026-05-14T00:00:00-05:00",
    updated_at: "2026-05-14T00:00:00-05:00",
  };

  test("validates required canonical fields", () => {
    expect(validateTask(validTask, "valid.md").id).toBe("F-9999");
  });

  test("rejects missing required fields", () => {
    const { id: _id, ...missingId } = validTask;

    expect(() => validateTask(missingId, "missing-id.md")).toThrow(
      /missing-id\.md: field "id" must be a string/,
    );
  });

  test("rejects invalid depends_on shape", () => {
    expect(() =>
      validateTask({ ...validTask, depends_on: "F-0001" }, "bad-deps.md"),
    ).toThrow(/bad-deps\.md: field "depends_on" must be an array of strings/);
  });

  test("rejects invalid scope shape", () => {
    expect(() => validateTask({ ...validTask, scope: [1] }, "bad-scope.md")).toThrow(
      /bad-scope\.md: field "scope" must be an array of strings/,
    );
  });

  test("rejects invalid timestamps", () => {
    expect(() =>
      validateTask({ ...validTask, updated_at: "not-a-date" }, "bad-date.md"),
    ).toThrow(/bad-date\.md: field "updated_at" must be a parseable timestamp/);
  });

  test("rejects invalid optional close timestamp", () => {
    expect(() =>
      validateTask({ ...validTask, closed_at: "not-a-date" }, "bad-close-date.md"),
    ).toThrow(/bad-close-date\.md: field "closed_at" must be a parseable timestamp/);
  });

  test("uses a typed parse error", () => {
    try {
      validateTask({ ...validTask, status: "ready" }, "bad-status.md");
    } catch (error) {
      expect(error).toBeInstanceOf(TaskParseError);
      expect((error as TaskParseError).sourcePath).toBe("bad-status.md");
    }
  });
});
