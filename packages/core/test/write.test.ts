import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  claimTask,
  completeTask,
  parseTaskFile,
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
});

describe("task write helpers", () => {
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
      taskFile({ status: "doing", claimed_by: "codex" }),
    );

    await completeTask(repoRoot, "F-9999", new Date("2026-05-14T13:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("done");
    expect(parsed.task.claimed_by).toBe("");
    expect(parsed.task.updated_at).toBe("2026-05-14T13:00:00.000Z");
    expect(parsed.task.closed_at).toBe("2026-05-14T13:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Example\n\nBody stays readable.\n");
  });
});
