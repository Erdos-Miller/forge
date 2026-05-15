import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendTaskNote,
  blockTask,
  claimTask,
  completeTask,
  createTask,
  createTaskFileContents,
  parseTaskFile,
  requestTaskReview,
  unblockTask,
  updateTaskFileContents,
} from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

function taskFile(overrides: Partial<Record<string, string>> = {}): string {
  return [
    "---",
    `id: ${overrides.id ?? "F-9999"}`,
    `title: ${overrides.title ?? "Example"}`,
    "kind: task",
    `status: ${overrides.status ?? "open"}`,
    "priority: medium",
    'parent: ""',
    "depends_on: []",
    `claimed_by: ${JSON.stringify(overrides.claimed_by ?? "")}`,
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-14T00:00:00-05:00",
    `updated_at: ${overrides.updated_at ?? "2026-05-14T00:00:00-05:00"}`,
    ...(overrides.blocked_reason ? [`blocked_reason: ${overrides.blocked_reason}`] : []),
    ...(overrides.review_reason ? [`review_reason: ${overrides.review_reason}`] : []),
    "---",
    "",
    "# Example",
    "",
    "Body stays readable.",
    "",
  ].join("\n");
}

async function makeRepo(contents = taskFile()): Promise<{ repoRoot: string; taskPath: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-core-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  const taskPath = path.join(tasksDir, "F-9999-example.md");
  await fs.writeFile(taskPath, contents);
  return { repoRoot, taskPath };
}

describe("updateTaskFileContents", () => {
  test("updates frontmatter fields while preserving the markdown body", () => {
    const original = taskFile();
    const updated = updateTaskFileContents(original, {
      status: "doing",
      claimed_by: "codex",
      updated_at: "2026-05-14T12:00:00.000Z",
    });

    const parsed = parseTaskFile("updated.md", updated);

    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("preserves unknown frontmatter fields and markdown sections", () => {
    const original = [
      "---",
      "id: F-9999",
      "title: Example",
      "kind: task",
      "status: open",
      "priority: medium",
      'parent: ""',
      "depends_on: []",
      'claimed_by: ""',
      "custom_field: keep me",
      "scope:",
      "  - packages/**",
      "created_at: 2026-05-14T00:00:00-05:00",
      "updated_at: 2026-05-14T00:00:00-05:00",
      "---",
      "",
      "# Example",
      "",
      "## Custom",
      "",
      "Do not lose this.",
      "",
    ].join("\n");

    const updated = updateTaskFileContents(original, {
      status: "doing",
      updated_at: "2026-05-14T12:00:00.000Z",
    });

    expect(updated).toContain("custom_field: keep me");
    expect(updated).toContain("## Custom\n\nDo not lose this.");
  });

  test("replaces multiline array fields with quoted values", () => {
    const updated = updateTaskFileContents(taskFile(), {
      scope: ["packages/core/**", "value:with-colon"],
      updated_at: "2026-05-14T12:00:00.000Z",
    });

    const parsed = parseTaskFile("updated.md", updated);
    expect(parsed.task.scope).toEqual(["packages/core/**", "value:with-colon"]);
    expect(updated).toContain('scope:\n  - "packages/core/**"\n  - "value:with-colon"');
  });
});

describe("task write helpers", () => {
  test("createTask quotes glob scopes so generated tasks reparse", async () => {
    const { repoRoot } = await makeRepo();

    const task = await createTask(
      repoRoot,
      {
        id: "F-9998",
        title: "Default scope",
      },
      new Date("2026-05-14T12:00:00Z"),
    );

    expect(task.scope).toEqual(["**"]);
    expect(await fs.readFile(task.sourcePath, "utf8")).toContain('  - "**"');
  });

  test("createTask quotes special YAML array scalars", () => {
    const contents = createTaskFileContents(
      {
        id: "F-9998",
        title: "Special arrays",
        scope: ["packages/**", "value:with-colon", "#hash"],
        depends_on: ["F-0001"],
      },
      new Date("2026-05-14T12:00:00Z"),
    );

    const parsed = parseTaskFile("special.md", contents);
    expect(parsed.task.scope).toEqual(["packages/**", "value:with-colon", "#hash"]);
    expect(parsed.task.depends_on).toEqual(["F-0001"]);
  });

  test("claimTask updates status, claimed_by, and updated_at", async () => {
    const { repoRoot, taskPath } = await makeRepo();

    await claimTask(repoRoot, "F-9999", "codex", new Date("2026-05-14T12:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("completeTask marks a task done and clears claimed_by", async () => {
    const { repoRoot, taskPath } = await makeRepo(
      taskFile({
        status: "doing",
        claimed_by: "codex",
        blocked_reason: "Waiting",
        review_reason: "Check",
      }),
    );

    await completeTask(repoRoot, "F-9999", new Date("2026-05-14T13:00:00Z"), "Verified");

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("done");
    expect(parsed.task.claimed_by).toBe("");
    expect(parsed.task.updated_at).toBe("2026-05-14T13:00:00.000Z");
    expect(parsed.task.closed_at).toBe("2026-05-14T13:00:00.000Z");
    expect(parsed.task.close_reason).toBe("Verified");
    expect(parsed.task.blocked_reason).toBe("");
    expect(parsed.task.review_reason).toBe("");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("blockTask records blocked status and reason", async () => {
    const { repoRoot, taskPath } = await makeRepo();

    await blockTask(repoRoot, "F-9999", "Waiting on API", new Date("2026-05-14T14:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("blocked");
    expect(parsed.task.blocked_reason).toBe("Waiting on API");
    expect(parsed.task.updated_at).toBe("2026-05-14T14:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("unblockTask clears blocked_reason and reopens the task", async () => {
    const { repoRoot, taskPath } = await makeRepo(
      taskFile({ status: "blocked", blocked_reason: "Waiting" }),
    );

    await unblockTask(repoRoot, "F-9999", new Date("2026-05-14T15:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("open");
    expect(parsed.task.blocked_reason).toBe("");
    expect(parsed.task.updated_at).toBe("2026-05-14T15:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("requestTaskReview records review_reason without changing status", async () => {
    const { repoRoot, taskPath } = await makeRepo(taskFile({ status: "doing" }));

    await requestTaskReview(repoRoot, "F-9999", "Needs review", new Date("2026-05-14T16:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.review_reason).toBe("Needs review");
    expect(parsed.task.updated_at).toBe("2026-05-14T16:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });

  test("appendTaskNote appends to the Notes section and preserves the rest of the body", async () => {
    const { repoRoot, taskPath } = await makeRepo(
      [
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
        "## Notes",
        "",
        "Existing note.",
        "",
        "## History",
        "",
        "- Created.",
        "",
      ].join("\n"),
    );

    await appendTaskNote(repoRoot, "F-9999", "New note.", new Date("2026-05-14T17:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.updated_at).toBe("2026-05-14T17:00:00.000Z");
    expect(parsed.task.body).toContain("Existing note.\n\nNew note.\n\n## History");
  });

  test("writes fail clearly on malformed frontmatter", async () => {
    const { repoRoot } = await makeRepo("---\nid: [\n---\n");

    await expect(claimTask(repoRoot, "F-9999", "codex")).rejects.toThrow(
      /malformed YAML frontmatter/,
    );
  });

  test("writes fail clearly on merge conflict markers", async () => {
    const { repoRoot } = await makeRepo(`${taskFile()}\n<<<<<<< ours\n=======\n>>>>>>> theirs\n`);

    await expect(claimTask(repoRoot, "F-9999", "codex")).rejects.toThrow(
      /merge conflict markers/,
    );
  });

  test("updates use a same-directory temp file and leave no temp file behind", async () => {
    const { repoRoot, taskPath } = await makeRepo();

    await claimTask(repoRoot, "F-9999", "codex", new Date("2026-05-14T18:00:00Z"));

    const taskDirEntries = await fs.readdir(path.dirname(taskPath));
    expect(taskDirEntries.filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
  });
});
