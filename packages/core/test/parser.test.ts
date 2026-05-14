import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  TaskParseError,
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

  test("uses a typed parse error", () => {
    try {
      validateTask({ ...validTask, status: "ready" }, "bad-status.md");
    } catch (error) {
      expect(error).toBeInstanceOf(TaskParseError);
      expect((error as TaskParseError).sourcePath).toBe("bad-status.md");
    }
  });
});
