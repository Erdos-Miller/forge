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
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-plan-doctor-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  return { repoRoot, tasksDir };
}

async function runDoctor(repoRoot: string): Promise<{
  code: number;
  payload: any;
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });

  expect(stderr).toEqual([]);
  return { code, payload: JSON.parse(stdout[0]) };
}

describe("execution plan doctor warnings", () => {
  test("warns for claimed and doing tasks without execution plans", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(
      path.join(tasksDir, "F-0001-claimed.md"),
      taskFile({ id: "F-0001", status: "open", claimedBy: "codex" }),
    );
    await fs.writeFile(
      path.join(tasksDir, "F-0002-doing.md"),
      taskFile({ id: "F-0002", status: "doing" }),
    );

    const { code, payload } = await runDoctor(repoRoot);
    const diagnostics = payload.diagnostics.filter((diagnostic: any) =>
      diagnostic.code === "missing_execution_plan"
    );

    expect(code).toBe(0);
    expect(payload.summary).toEqual({ errors: 0, warnings: 2 });
    expect(diagnostics.map((diagnostic: any) => diagnostic.taskId).sort()).toEqual([
      "F-0001",
      "F-0002",
    ]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.severity).toBe("warning");
      expect(diagnostic.sourcePath).toContain(tasksDir);
      expect(diagnostic.message).toContain(`forge plan ${diagnostic.taskId} --stdin`);
    }
  });

  test("does not warn for unclaimed open tasks or active tasks with plans", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(
      path.join(tasksDir, "F-0001-open.md"),
      taskFile({ id: "F-0001", status: "open" }),
    );
    await fs.writeFile(
      path.join(tasksDir, "F-0002-planned.md"),
      taskFile({
        id: "F-0002",
        status: "doing",
        body: completeBriefBody("Planned", ["## Execution Plan", "", "Use the plan.", ""]),
      }),
    );

    const { code, payload } = await runDoctor(repoRoot);

    expect(code).toBe(0);
    expect(payload.summary).toEqual({ errors: 0, warnings: 0 });
    expect(payload.diagnostics).toEqual([]);
  });
});

function taskFile(options: {
  id: string;
  status: "open" | "doing";
  claimedBy?: string;
  body?: string;
}): string {
  return [
    "---",
    `id: ${options.id}`,
    "title: Test",
    "kind: task",
    `status: ${options.status}`,
    "priority: medium",
    'parent: ""',
    "depends_on: []",
    `claimed_by: ${JSON.stringify(options.claimedBy ?? "")}`,
    "scope:",
    "  - '**'",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    "---",
    "",
    options.body ?? completeBriefBody("Test"),
  ].join("\n");
}

function completeBriefBody(title: string, extraSections: string[] = []): string {
  return [
    `# ${title}`,
    "",
    "## Why",
    "",
    "The task has enough context.",
    "",
    "## What success looks like",
    "",
    "The expected end state is clear.",
    "",
    "## Acceptance Criteria",
    "",
    "- The task has observable criteria.",
    "",
    ...extraSections,
    ...(extraSections.length ? [""] : []),
    "## Verification",
    "",
    "- bun test",
    "",
    "## Notes",
    "",
    "",
  ].join("\n");
}
