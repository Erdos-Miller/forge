import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

describe("doctor worktree coordination", () => {
  test("reports dirty worktree diagnostics for active claimed tasks", async () => {
    const repoRoot = await makeRepo();
    const tasksDir = path.join(repoRoot, ".forge", "tasks");
    await fs.writeFile(
      path.join(repoRoot, "packages", "cli", "src", "dirty.ts"),
      "dirty\n",
    );
    await fs.appendFile(path.join(repoRoot, "package.json"), " \n");
    await fs.writeFile(
      path.join(tasksDir, "F-9999-future.md"),
      taskFile("F-9999", "Future", { status: "open" }),
    );

    const payload = await runDoctor(repoRoot);
    const diagnostics = payload.diagnostics.filter((diagnostic: any) =>
      diagnostic.code.startsWith("dirty_worktree_"),
    );

    expect(diagnostics.map((diagnostic: any) => diagnostic.code).sort()).toEqual([
      "dirty_worktree_blocking",
      "dirty_worktree_review",
    ]);
    expect(diagnostics.map((diagnostic: any) => diagnostic.sourcePath)).not.toContain(
      path.join(repoRoot, ".forge", "tasks", "F-9999-future.md"),
    );
    expect(diagnostics.map((diagnostic: any) => diagnostic.taskId)).toEqual([
      "F-0200",
      "F-0200",
    ]);
  });
});

async function makeRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-doctor-worktree-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(path.join(repoRoot, "packages", "cli", "src"), { recursive: true });
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(path.join(repoRoot, "package.json"), "{}\n");
  await fs.writeFile(
    path.join(tasksDir, "F-0200-active.md"),
    taskFile("F-0200", "Active", { status: "doing", claimedBy: "codex" }),
  );
  await runGit(repoRoot, ["init"]);
  await runGit(repoRoot, ["add", "."]);
  await runGit(repoRoot, [
    "-c",
    "user.email=forge@example.test",
    "-c",
    "user.name=Forge Test",
    "commit",
    "-m",
    "initial",
  ]);
  return repoRoot;
}

function taskFile(
  id: string,
  title: string,
  options: { claimedBy?: string; status?: string } = {},
): string {
  return [
    "---",
    `id: ${id}`,
    `title: ${JSON.stringify(title)}`,
    "kind: task",
    `status: ${options.status ?? "open"}`,
    "priority: high",
    'parent: ""',
    "depends_on: []",
    `claimed_by: ${JSON.stringify(options.claimedBy ?? "")}`,
    "scope:",
    '  - "packages/**"',
    "created_at: 2026-05-14T00:00:00Z",
    "updated_at: 2026-05-14T00:00:00Z",
    "---",
    "",
    `# ${title}`,
    "",
    "## Why",
    "",
    "Test task.",
    "",
    "## What success looks like",
    "",
    "The command reports coordination diagnostics.",
    "",
    "## Acceptance Criteria",
    "",
    "- It reports dirty state.",
    "",
    "## Verification",
    "",
    "- bun test",
    "",
    "## Execution Plan",
    "",
    "Summary: Test plan.",
    "",
    "## Notes",
    "",
    "Fixture.",
    "",
  ].join("\n");
}

async function runDoctor(repoRoot: string): Promise<any> {
  const stdout: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  return JSON.parse(stdout[0]);
}

async function runGit(cwd: string, args: string[]) {
  const proc = Bun.spawn(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) {
    throw new Error(stderr.trim() || `git ${args.join(" ")} failed`);
  }
}
