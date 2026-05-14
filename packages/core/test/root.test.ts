import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  claimTaskFrom,
  completeTaskFrom,
  findForgeRoot,
  loadTasksFrom,
  parseTaskFile,
} from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

function taskFile(overrides: Partial<Record<string, string>> = {}): string {
  const area = overrides.area ? [`area: ${overrides.area}`] : [];
  return [
    "---",
    `id: ${overrides.id ?? "F-9999"}`,
    `title: ${overrides.title ?? "Example"}`,
    "kind: task",
    `status: ${overrides.status ?? "open"}`,
    "priority: medium",
    ...area,
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
  ].join("\n");
}

async function makeRepo(): Promise<{
  repoRoot: string;
  nestedDir: string;
  taskPath: string;
}> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-root-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const nestedDir = path.join(repoRoot, "packages", "core", "src");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });
  const taskPath = path.join(tasksDir, "F-9999-example.md");
  await fs.writeFile(taskPath, taskFile({ area: "core" }));
  return { repoRoot, nestedDir, taskPath };
}

describe("findForgeRoot", () => {
  test("discovers .forge from the repo root", async () => {
    const { repoRoot } = await makeRepo();

    expect(await findForgeRoot(repoRoot)).toBe(repoRoot);
  });

  test("discovers .forge from nested subdirectories", async () => {
    const { repoRoot, nestedDir } = await makeRepo();

    expect(await findForgeRoot(nestedDir)).toBe(repoRoot);
  });

  test("fails clearly when no .forge directory exists", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "forge-empty-test-"));
    tempDirs.push(emptyDir);

    await expect(findForgeRoot(emptyDir)).rejects.toThrow(
      new RegExp(`no \\.forge directory found from ${emptyDir}`),
    );
  });
});

describe("loadTasksFrom", () => {
  test("loads tasks from a nested directory and parses optional area", async () => {
    const { nestedDir } = await makeRepo();

    const tasks = await loadTasksFrom(nestedDir);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("F-9999");
    expect(tasks[0].area).toBe("core");
  });

  test("parses tasks without area", () => {
    const parsed = parseTaskFile("no-area.md", taskFile({ area: undefined }));

    expect(parsed.task.area).toBeUndefined();
  });
});

describe("nested write helpers", () => {
  test("claimTaskFrom updates the root task file from a nested directory", async () => {
    const { nestedDir, taskPath } = await makeRepo();

    await claimTaskFrom(nestedDir, "F-9999", "codex", new Date("2026-05-14T12:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");
  });

  test("completeTaskFrom updates the root task file from a nested directory", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    await claimTaskFrom(nestedDir, "F-9999", "codex", new Date("2026-05-14T12:00:00Z"));

    await completeTaskFrom(nestedDir, "F-9999", new Date("2026-05-14T13:00:00Z"));

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(parsed.task.status).toBe("done");
    expect(parsed.task.claimed_by).toBe("");
  });
});
