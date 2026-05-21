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
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-brief-doctor-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  return { repoRoot, tasksDir };
}

async function runDoctor(repoRoot: string): Promise<any> {
  const stdout: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });

  expect(code).toBe(0);
  return JSON.parse(stdout[0]);
}

describe("task brief doctor warnings", () => {
  test("warns for missing and placeholder expected fields", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(
      path.join(tasksDir, "F-0001-placeholder.md"),
      taskFile("F-0001", placeholderBody()),
    );
    await fs.writeFile(path.join(tasksDir, "F-0002-missing.md"), taskFile("F-0002", "# Missing\n"));

    const payload = await runDoctor(repoRoot);
    const diagnostics = payload.diagnostics.filter((diagnostic: any) =>
      diagnostic.code.startsWith("task_brief_"),
    );

    expect(diagnostics.map((diagnostic: any) => diagnostic.code)).toEqual([
      "task_brief_placeholder_why",
      "task_brief_placeholder_success",
      "task_brief_placeholder_acceptance",
      "task_brief_placeholder_verification",
      "task_brief_missing_why",
      "task_brief_missing_success",
      "task_brief_missing_acceptance",
      "task_brief_missing_verification",
    ]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic).toMatchObject({
        severity: "warning",
        sourcePath: expect.stringContaining(".md"),
        repairHint: expect.stringContaining("Fill in ##"),
      });
    }
  });

  test("does not warn for empty notes or closed historical tasks", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(path.join(tasksDir, "F-0001-complete.md"), taskFile("F-0001", completeBody()));
    await fs.writeFile(
      path.join(tasksDir, "F-0002-done.md"),
      taskFile("F-0002", "# Old task\n", "done"),
    );

    const payload = await runDoctor(repoRoot);

    expect(payload.summary).toEqual({ errors: 0, warnings: 0 });
    expect(payload.diagnostics).toEqual([]);
  });
});

function taskFile(id: string, body: string, status = "open"): string {
  const closedFields =
    status === "done"
      ? ["closed_at: 2026-05-14T01:00:00-05:00", "close_reason: Historical"]
      : [];
  return [
    "---",
    `id: ${id}`,
    "title: Brief",
    "kind: task",
    `status: ${status}`,
    "priority: medium",
    'parent: ""',
    "depends_on: []",
    'claimed_by: ""',
    "scope:",
    "  - '**'",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    ...closedFields,
    "---",
    "",
    body,
  ].join("\n");
}

function placeholderBody(): string {
  return [
    "# Placeholder",
    "",
    "## Why",
    "",
    "TODO: Explain why.",
    "",
    "## What success looks like",
    "",
    "TODO: Describe success.",
    "",
    "## Acceptance Criteria",
    "",
    "- TODO: Add criteria.",
    "",
    "## Verification",
    "",
    "- TODO: Add commands.",
    "",
  ].join("\n");
}

function completeBody(): string {
  return [
    "# Complete",
    "",
    "## Why",
    "",
    "The task has concrete context.",
    "",
    "## What success looks like",
    "",
    "The expected outcome is clear.",
    "",
    "## Acceptance Criteria",
    "",
    "- The task has observable criteria.",
    "",
    "## Verification",
    "",
    "- bun test",
    "",
    "## Notes",
    "",
    "",
  ].join("\n");
}
