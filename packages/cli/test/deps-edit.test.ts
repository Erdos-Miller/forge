import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<{ repoRoot: string; tasksDir: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-cli-deps-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  return { repoRoot, tasksDir };
}

async function writeTask(
  tasksDir: string,
  id: string,
  overrides: { title?: string; dependsOn?: string[]; body?: string } = {},
): Promise<void> {
  const title = overrides.title ?? id;
  await fs.writeFile(
    path.join(tasksDir, `${id.toLowerCase()}.md`),
    [
      "---",
      `id: ${id}`,
      `title: ${title}`,
      "kind: task",
      "status: open",
      "priority: medium",
      'parent: ""',
      ...(overrides.dependsOn?.length
        ? ["depends_on:", ...overrides.dependsOn.map((dependencyId) => `  - ${dependencyId}`)]
        : ["depends_on: []"]),
      'claimed_by: ""',
      "custom_field: keep me",
      "scope:",
      "  - packages/**",
      "created_at: 2026-05-14T00:00:00-05:00",
      "updated_at: 2026-05-14T00:00:00-05:00",
      "---",
      "",
      `# ${title}`,
      "",
      overrides.body ?? "Body stays readable.",
      "",
    ].join("\n"),
  );
}

async function runJson(
  cwd: string,
  args: string[],
): Promise<{ code: number; stdout: unknown; stderr: unknown }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    now: new Date("2026-05-15T12:00:00Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });

  return {
    code,
    stdout: stdout[0] ? JSON.parse(stdout[0]) : null,
    stderr: stderr[0] ? JSON.parse(stderr[0]) : null,
  };
}

describe("deps edit commands", () => {
  test("adds and removes dependencies with JSON no-op responses", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, "F-0001");
    await writeTask(tasksDir, "F-0002");

    const added = await runJson(repoRoot, ["deps", "add", "F-0002", "F-0001", "--json"]);
    const duplicate = await runJson(repoRoot, ["deps", "add", "F-0002", "F-0001", "--json"]);
    const removed = await runJson(repoRoot, ["deps", "remove", "F-0002", "F-0001", "--json"]);
    const absent = await runJson(repoRoot, ["deps", "remove", "F-0002", "F-0001", "--json"]);

    expect(added.code).toBe(0);
    expect(added.stdout).toMatchObject({
      ok: true,
      action: "add",
      changed: true,
      reason: "added",
      task: { id: "F-0002", depends_on: ["F-0001"] },
    });
    expect(duplicate.stdout).toMatchObject({ changed: false, reason: "already_present" });
    expect(removed.stdout).toMatchObject({
      action: "remove",
      changed: true,
      reason: "removed",
      task: { id: "F-0002", depends_on: [] },
    });
    expect(absent.stdout).toMatchObject({ changed: false, reason: "absent" });
  });

  test("preserves existing deps read JSON shape", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, "F-0001");
    await writeTask(tasksDir, "F-0002", { dependsOn: ["F-0001"] });

    const result = await runJson(repoRoot, ["deps", "F-0002", "--json"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toMatchObject({
      ok: true,
      version: 1,
      taskId: "F-0002",
      depends_on: [{ id: "F-0001", title: "F-0001" }],
      dependents: [],
    });
  });

  test("returns JSON errors for missing ids, cycles, and invalid usage", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, "F-0001", { dependsOn: ["F-0002"] });
    await writeTask(tasksDir, "F-0002");

    const missing = await runJson(repoRoot, ["deps", "add", "F-0001", "F-4040", "--json"]);
    const cycle = await runJson(repoRoot, ["deps", "add", "F-0002", "F-0001", "--json"]);
    const usage = await runJson(repoRoot, ["deps", "add", "F-0002", "F-0001"]);

    expect(missing.code).toBe(3);
    expect(missing.stderr).toMatchObject({
      ok: false,
      error: { code: "task_not_found", details: { taskId: "F-4040" } },
    });
    expect(cycle.code).toBe(4);
    expect(cycle.stderr).toMatchObject({
      ok: false,
      error: { code: "dependency_cycle" },
    });
    expect(usage.code).toBe(2);
    expect(usage.stderr).toMatchObject({
      ok: false,
      error: { code: "usage_error" },
    });
  });
});
