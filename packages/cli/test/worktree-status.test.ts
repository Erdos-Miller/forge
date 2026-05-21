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
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-worktree-status-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(path.join(repoRoot, "packages", "cli", "src"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "packages", "web", "src"), { recursive: true });
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(path.join(repoRoot, "packages", "cli", "src", ".gitkeep"), "");
  await fs.writeFile(path.join(repoRoot, "packages", "web", "src", ".gitkeep"), "");
  await fs.writeFile(path.join(repoRoot, "package.json"), "{}\n");
  await writeTask(tasksDir, {
    id: "F-0001",
    title: "Dependency",
    status: "done",
    closedAt: "2026-05-14T00:00:00Z",
  });
  await writeTask(tasksDir, {
    id: "F-0002",
    title: "Claimed",
    claimedBy: "codex",
    dependsOn: ["F-0001"],
    scope: ["packages/cli/**"],
  });
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
  return { repoRoot, tasksDir };
}

async function writeTask(
  tasksDir: string,
  input: {
    id: string;
    title: string;
    status?: string;
    claimedBy?: string;
    dependsOn?: string[];
    scope?: string[];
    closedAt?: string;
  },
) {
  await fs.writeFile(
    path.join(tasksDir, `${input.id.toLowerCase()}.md`),
    [
      "---",
      `id: ${input.id}`,
      `title: ${JSON.stringify(input.title)}`,
      "kind: task",
      `status: ${input.status ?? "doing"}`,
      "priority: high",
      'parent: ""',
      ...(input.dependsOn?.length
        ? ["depends_on:", ...input.dependsOn.map((id) => `  - ${id}`)]
        : ["depends_on: []"]),
      `claimed_by: ${JSON.stringify(input.claimedBy ?? "")}`,
      "scope:",
      ...(input.scope ?? ["packages/**"]).map((scope) => `  - ${JSON.stringify(scope)}`),
      "created_at: 2026-05-14T00:00:00Z",
      "updated_at: 2026-05-14T00:00:00Z",
      ...(input.closedAt ? [`closed_at: ${input.closedAt}`] : []),
      "---",
      "",
      `# ${input.title}`,
      "",
      "## Why",
      "",
      "Test task.",
      "",
      "## What success looks like",
      "",
      "The command classifies files.",
      "",
      "## Acceptance Criteria",
      "",
      "- It works.",
      "",
      "## Verification",
      "",
      "- bun test",
      "",
      "## Notes",
      "",
      "Fixture.",
      "",
    ].join("\n"),
  );
}

async function runJson(cwd: string, args: string[]) {
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

async function runGit(cwd: string, args: string[]) {
  const proc = Bun.spawn(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) {
    throw new Error(stderr.trim() || `git ${args.join(" ")} failed`);
  }
}

describe("worktree-status", () => {
  test("reports a clean tree for the single active claimed task", async () => {
    const { repoRoot } = await makeRepo();

    const result = await runJson(repoRoot, ["worktree-status", "--json"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toMatchObject({
      ok: true,
      task: { id: "F-0002" },
      summary: { clean: true, taskInference: "single_active_claimed" },
      files: [],
      recommendation: "continue",
    });
  });

  test("classifies scoped, planning, dependency, and shared files", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(path.join(repoRoot, "packages", "cli", "src", "dirty.ts"), "dirty\n");
    await fs.writeFile(path.join(repoRoot, "packages", "web", "src", "future.ts"), "future\n");
    await fs.appendFile(path.join(repoRoot, "package.json"), " \n");
    await fs.appendFile(path.join(tasksDir, "f-0001.md"), "\nDependency note.\n");
    await writeTask(tasksDir, {
      id: "F-9999",
      title: "Future",
      status: "open",
      scope: [".forge/**"],
    });

    const result = await runJson(repoRoot, ["worktree-status", "--json"]);
    const files = Object.fromEntries(result.stdout.files.map((file: any) => [file.path, file]));

    expect(result.stdout.summary).toMatchObject({ blocking: 1, review: 2, non_blocking: 2 });
    expect(result.stdout.recommendation).toBe("stop");
    expect(files["packages/cli/src/dirty.ts"]).toMatchObject({
      classification: "blocking",
      reason: "inside_task_scope",
    });
    expect(files[".forge/tasks/f-9999.md"]).toMatchObject({
      classification: "non_blocking",
      reason: "future_task_file",
    });
    expect(files["packages/web/src/future.ts"]).toMatchObject({
      classification: "non_blocking",
      reason: "outside_task_scope",
    });
    expect(files[".forge/tasks/f-0001.md"]).toMatchObject({
      classification: "review",
      reason: "dependency_task_file",
    });
    expect(files["package.json"]).toMatchObject({
      classification: "review",
      reason: "shared_file",
    });
  });

  test("returns review when task inference is ambiguous", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, {
      id: "F-0003",
      title: "Second claimed",
      claimedBy: "codex",
      scope: ["packages/web/**"],
    });
    await fs.writeFile(path.join(repoRoot, "packages", "web", "src", "dirty.ts"), "dirty\n");

    const inferred = await runJson(repoRoot, ["worktree-status", "--json"]);
    const explicit = await runJson(repoRoot, ["worktree-status", "--json", "--task", "F-0002"]);

    expect(inferred.stdout).toMatchObject({
      task: null,
      summary: { taskInference: "ambiguous" },
      recommendation: "review",
    });
    expect(inferred.stdout.files[0]).toMatchObject({
      classification: "review",
      reason: "task_inference_ambiguous",
    });
    expect(explicit.stdout).toMatchObject({
      task: { id: "F-0002" },
      summary: { taskInference: "explicit" },
    });
  });

  test("returns JSON usage errors", async () => {
    const { repoRoot } = await makeRepo();

    const result = await runJson(repoRoot, ["worktree-status"]);

    expect(result.code).toBe(2);
    expect(result.stderr).toMatchObject({
      ok: false,
      error: { code: "usage_error" },
    });
  });
});
