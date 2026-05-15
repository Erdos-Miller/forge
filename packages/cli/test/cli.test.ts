import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTaskFile } from "@forge/core";
import { COMMANDS, runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

function taskFile(options: {
  id: string;
  title: string;
  status?: string;
  claimed_by?: string;
  depends_on?: string[];
  area?: string;
  priority?: string;
  closed_at?: string | null;
  body?: string;
}): string {
  const dependsOn = options.depends_on?.length
    ? options.depends_on.map((id) => `  - ${id}`).join("\n")
    : "[]";
  const area = options.area ? [`area: ${options.area}`] : [];
  const isClosed = options.status === "done" || options.status === "canceled";
  const closedAt =
    options.closed_at === null
      ? []
      : options.closed_at
        ? [`closed_at: ${options.closed_at}`]
        : isClosed
          ? ["closed_at: 2026-05-14T01:00:00-05:00"]
          : [];

  return [
    "---",
    `id: ${options.id}`,
    `title: ${options.title}`,
    "kind: task",
    `status: ${options.status ?? "open"}`,
    `priority: ${options.priority ?? "medium"}`,
    ...area,
    'parent: ""',
    `depends_on: ${dependsOn === "[]" ? "[]" : "\n" + dependsOn}`,
    `claimed_by: ${JSON.stringify(options.claimed_by ?? "")}`,
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    ...closedAt,
    "---",
    "",
    options.body ?? [`# ${options.title}`, "", "Body stays readable.", ""].join("\n"),
  ].join("\n");
}

async function makeRepo(): Promise<{
  repoRoot: string;
  nestedDir: string;
  taskPath: string;
}> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-cli-test-"));
  tempDirs.push(repoRoot);

  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const nestedDir = path.join(repoRoot, "packages", "cli", "src");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });

  const donePath = path.join(tasksDir, "F-0001-done.md");
  const openPath = path.join(tasksDir, "F-0002-open.md");
  const blockedPath = path.join(tasksDir, "F-0003-blocked.md");

  await fs.writeFile(donePath, taskFile({ id: "F-0001", title: "Done", status: "done" }));
  await fs.writeFile(
    openPath,
    taskFile({ id: "F-0002", title: "Open", depends_on: ["F-0001"] }),
  );
  await fs.writeFile(
    blockedPath,
    taskFile({ id: "F-0003", title: "Blocked", depends_on: ["F-0002"] }),
  );

  return { repoRoot, nestedDir, taskPath: openPath };
}

async function writeGuidanceFixture(repoRoot: string): Promise<void> {
  const forgeDir = path.join(repoRoot, ".forge");
  const guidanceDir = path.join(forgeDir, "guidance");
  await fs.mkdir(guidanceDir, { recursive: true });
  await fs.writeFile(
    path.join(forgeDir, "guidance.yml"),
    [
      "version: 1",
      "routes:",
      "  - include: guidance/core.md",
      "    when:",
      "      cwd:",
      "        - packages/cli/**",
      "  - include: guidance/core.md",
      "    when:",
      "      path:",
      "        - packages/cli/src/**",
      "  - include: guidance/task.md",
      "    when:",
      "      scope:",
      "        - packages/**",
      "",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(guidanceDir, "core.md"),
    ["# Core", "", "## Prompt Summary", "", "Use the local CLI patterns.", ""].join("\n"),
  );
  await fs.writeFile(
    path.join(guidanceDir, "task.md"),
    ["# Task", "", "## Prompt Summary", "", "Task-scoped guidance.", ""].join("\n"),
  );
}

async function run(
  cwd: string,
  args: string[],
  stdin = "",
): Promise<{ code: number; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    env: { USER: "tester" },
    now: new Date("2026-05-14T12:00:00Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    stdin: async () => stdin,
  });

  return { code, stdout, stderr };
}

function parseStdoutJson(result: { stdout: string[] }): any {
  expect(result.stdout).toHaveLength(1);
  return JSON.parse(result.stdout[0]);
}

function parseStderrJson(result: { stderr: string[] }): any {
  expect(result.stderr).toHaveLength(1);
  return JSON.parse(result.stderr[0]);
}

describe("forge cli", () => {
  test("command registry covers the runnable CLI surface", () => {
    expect(COMMANDS.map((command) => command.name)).toEqual([
      "commands",
      "help",
      "list",
      "ready",
      "queue",
      "next",
      "show",
      "blockers",
      "deps",
      "guidance",
      "doctor",
      "closeout",
      "create",
      "prompt",
      "plan",
      "loop-prompt",
      "claim",
      "note",
      "block",
      "unblock",
      "review",
      "set",
      "done",
      "web",
    ]);

    for (const command of COMMANDS) {
      expect(command.usage.startsWith(`forge ${command.name}`)).toBe(true);
      expect(command.description.length).toBeGreaterThan(0);
      expect(command.examples.length).toBeGreaterThan(0);
      expect(command.agentPurpose.length).toBeGreaterThan(0);
    }
  });

  test("top-level usage is generated from registered commands in order", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["--help"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      ["Usage:", ...COMMANDS.map((command) => `  ${command.usage}`)].join("\n"),
    ]);
  });

  test("commands --json emits stable registry metadata", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["commands", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload.version).toBe(1);
    expect(payload.commands.map((command: any) => command.name)).toEqual(
      COMMANDS.map((command) => command.name),
    );
    expect(payload.commands[0]).toEqual({
      name: "commands",
      usage: "forge commands --json",
      description: "Emit command metadata.",
      workflow: "inspect",
      classification: "read",
      supportsJson: true,
      examples: ["forge commands --json"],
      agentPurpose: "Discover the current CLI surface in robot-readable form.",
    });
    expect(payload.commands.find((command: any) => command.name === "done").classification).toBe(
      "write",
    );
    expect(payload.commands.find((command: any) => command.name === "doctor").workflow).toBe(
      "verify",
    );
  });

  test("commands --json rejects invalid usage with a robot error", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["commands"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(2);
    expect(payload.error.message).toBe("usage: forge commands --json");
  });

  test("help --agent groups commands by workflow with classification", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["help", "--agent"]);
    const text = result.stdout[0];

    expect(result.code).toBe(0);
    expect(text).toContain("Inspect:\n- forge commands --json [read]");
    expect(text).toContain("Claim:\n- forge next [--claim] [--by <name>] --json [write]");
    expect(text).toContain("Plan:\n- forge create <id> --title <title> [options] [write]");
    expect(text).toContain("Mutate:\n- forge deps <id> --json");
    expect(text).toContain("- forge note <id> --stdin [write]");
    expect(text).toContain("Verify:\n- forge doctor --json [read]");
    expect(text).toContain("Close:\n- forge closeout <id> --json [read]");
    expect(text).toContain("- forge done <id> [--reason <text>] [--json] [write]");
  });

  test("help --agent rejects invalid usage", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["help"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["usage: forge help --agent"]);
  });

  test("list prints active tasks by default", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["list"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      "F-0002\topen\t-\tOpen",
      "F-0003\topen\t-\tBlocked",
    ]);
  });

  test("list --all includes closed tasks", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["list", "--all"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      "F-0001\tdone\t-\tDone",
      "F-0002\topen\t-\tOpen",
      "F-0003\topen\t-\tBlocked",
    ]);
  });

  test("list --closed prints only done and canceled tasks", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["list", "--closed"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["F-0001\tdone\t-\tDone"]);
  });

  test("ready prints only ready tasks", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["ready"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["F-0002\topen\t-\tOpen"]);
  });

  test("list and ready work from nested directories", async () => {
    const { nestedDir } = await makeRepo();

    expect((await run(nestedDir, ["list"])).stdout).toContain("F-0002\topen\t-\tOpen");
    expect((await run(nestedDir, ["list"])).stdout).not.toContain("F-0001\tdone\t-\tDone");
    expect((await run(nestedDir, ["ready"])).stdout).toEqual([
      "F-0002\topen\t-\tOpen",
    ]);
  });

  test("list rejects incompatible flags and unexpected args", async () => {
    const { repoRoot } = await makeRepo();

    expect(await run(repoRoot, ["list", "--all", "--closed"])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge list [--all|--closed]"],
    });
    expect(await run(repoRoot, ["list", "--cwd", repoRoot])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge list [--all|--closed]"],
    });
  });

  test("ready rejects unexpected extra args", async () => {
    const { repoRoot } = await makeRepo();

    expect(await run(repoRoot, ["ready", "--cwd", repoRoot])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge ready"],
    });
  });

  test("queue --json prints ranked ready tasks with diagnostics", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["queue", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.version).toBe(1);
    expect(payload.repoRoot).toBe(repoRoot);
    expect(payload.tasks.map((task: any) => task.id)).toEqual(["F-0002"]);
    expect(payload.tasks[0]).toMatchObject({
      id: "F-0002",
      title: "Open",
      claimed_by: null,
      ready: true,
      rank: 1,
      blockers: [],
      reasons: [
        { kind: "priority", priority: "medium", rank: 2 },
        { kind: "downstream_unblock_count", count: 1 },
        { kind: "no_blockers" },
      ],
    });
    expect(payload.diagnostics).toEqual({
      missingDependencies: [],
      dependencyCycles: [],
      duplicateTaskIds: [],
    });
  });

  test("queue --json rejects invalid usage with a robot error", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["queue"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(2);
    expect(payload.error.code).toBe("usage_error");
    expect(payload.error.message).toBe("usage: forge queue --json");
  });

  test("next --json returns the top ranked task without mutating it", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    const result = await run(repoRoot, ["next", "--json"]);
    const payload = parseStdoutJson(result);
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(payload).toMatchObject({
      ok: true,
      version: 1,
      reason: "ready",
      task: {
        id: "F-0002",
        status: "open",
        claimed_by: null,
        ready: true,
        rank: 1,
      },
    });
    expect(parsed.task.status).toBe("open");
    expect(parsed.task.claimed_by).toBe("");
  });

  test("next --claim --by --json claims and returns the top ranked task", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    const result = await run(repoRoot, ["next", "--claim", "--by", "codex", "--json"]);
    const payload = parseStdoutJson(result);
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(payload).toMatchObject({
      ok: true,
      version: 1,
      reason: "claimed",
      task: {
        id: "F-0002",
        status: "doing",
        claimed_by: "codex",
        ready: false,
        rank: 1,
      },
    });
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
  });

  test("next --json returns an empty response when no task is ready", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({ id: "F-0002", title: "Open", status: "doing", claimed_by: "codex" }),
    );

    const result = await run(repoRoot, ["next", "--claim", "--by", "codex", "--json"]);
    const payload = parseStdoutJson(result);
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(payload).toEqual({ ok: true, version: 1, task: null, reason: "empty" });
    expect(parsed.task.claimed_by).toBe("codex");
  });

  test("next rejects --by without --claim", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["next", "--by", "codex", "--json"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(2);
    expect(payload.error.code).toBe("usage_error");
    expect(payload.error.message).toBe("next option --by requires --claim");
  });

  test("show --json prints a task bundle with markdown sections", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({
        id: "F-0002",
        title: "Open",
        depends_on: ["F-0001"],
        body: [
          "# Open",
          "",
          "Intro.",
          "",
          "## Why",
          "",
          "Because agents need context.",
          "",
          "## Verification",
          "",
          "- bun test",
          "",
        ].join("\n"),
      }),
    );

    const result = await run(repoRoot, ["show", "F-0002", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload.task).toMatchObject({
      id: "F-0002",
      title: "Open",
      kind: "task",
      parent: null,
      claimed_by: null,
      depends_on: ["F-0001"],
      sourcePath: taskPath,
    });
    expect(payload.task.body).toContain("## Why");
    expect(payload.task.sections).toEqual([
      { title: "Why", body: "Because agents need context." },
      { title: "Verification", body: "- bun test" },
    ]);
  });

  test("show --json reports unknown task ids with robot error shape", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["show", "F-9999", "--json"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(3);
    expect(payload).toEqual({
      ok: false,
      version: 1,
      error: {
        code: "task_not_found",
        message: "task F-9999 not found",
        details: { taskId: "F-9999" },
      },
    });
  });

  test("blockers --json prints structured blockers for one task", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["blockers", "F-0003", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload).toEqual({
      ok: true,
      version: 1,
      taskId: "F-0003",
      blockers: [
        {
          kind: "dependency_status",
          message: "dependency F-0002 is open",
          taskId: "F-0003",
          dependencyId: "F-0002",
        },
      ],
    });
  });

  test("blockers --json does not treat active or claimed state as graph blockers", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({
        id: "F-0002",
        title: "Open",
        status: "doing",
        claimed_by: "codex",
        depends_on: ["F-0001"],
      }),
    );

    const result = await run(repoRoot, ["blockers", "F-0002", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload).toEqual({
      ok: true,
      version: 1,
      taskId: "F-0002",
      blockers: [],
    });
  });

  test("blockers --json reports unknown task ids", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["blockers", "F-9999", "--json"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(3);
    expect(payload.error.code).toBe("task_not_found");
  });

  test("deps --json prints direct dependencies and dependents", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["deps", "F-0002", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload).toEqual({
      ok: true,
      version: 1,
      taskId: "F-0002",
      depends_on: [{ id: "F-0001", title: "Done", status: "done" }],
      dependents: [{ id: "F-0003", title: "Blocked", status: "open" }],
    });
  });

  test("deps --json reports unknown task ids", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["deps", "F-9999", "--json"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(3);
    expect(payload.error.code).toBe("task_not_found");
  });

  test("guidance prints concise text output for cwd matches", async () => {
    const { repoRoot, nestedDir } = await makeRepo();
    await writeGuidanceFixture(repoRoot);

    const result = await run(nestedDir, ["guidance"]);

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("guidance/core.md");
    expect(result.stdout[0]).toContain("reasons: cwd:packages/cli/src");
    expect(result.stdout[0]).toContain("Use the local CLI patterns.");
    expect(result.stdout[0]).not.toContain("# Core");
  });

  test("guidance --json resolves task and path context", async () => {
    const { repoRoot } = await makeRepo();
    await writeGuidanceFixture(repoRoot);

    const result = await run(repoRoot, [
      "guidance",
      "--for-task",
      "F-0002",
      "--path",
      "packages/cli/src/index.ts",
      "--json",
    ]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.matches.map((match: any) => match.path)).toEqual([
      "guidance/core.md",
      "guidance/task.md",
    ]);
    expect(payload.matches[0].promptSummary).toBe("Use the local CLI patterns.");
    expect(payload.matches[0].content).toBeUndefined();
  });

  test("guidance --full includes full matched content", async () => {
    const { repoRoot } = await makeRepo();
    await writeGuidanceFixture(repoRoot);

    const result = await run(repoRoot, [
      "guidance",
      "--path",
      "packages/cli/src/index.ts",
      "--full",
      "--json",
    ]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload.matches[0].content).toContain("# Core");
  });

  test("guidance --json reports missing task ids", async () => {
    const { repoRoot } = await makeRepo();
    await writeGuidanceFixture(repoRoot);

    const result = await run(repoRoot, ["guidance", "--for-task", "F-9999", "--json"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(3);
    expect(payload.error.code).toBe("task_not_found");
  });

  test("doctor --json reports a clean task store", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["doctor", "--json"]);
    const payload = parseStdoutJson(result);

    expect(result.code).toBe(0);
    expect(payload).toEqual({
      ok: true,
      version: 1,
      summary: { errors: 0, warnings: 0 },
      diagnostics: [],
    });
  });

  test("doctor --json reports completion timestamp diagnostics", async () => {
    const { repoRoot } = await makeRepo();
    const tasksDir = path.join(repoRoot, ".forge", "tasks");
    await fs.writeFile(
      path.join(tasksDir, "valid-closed.md"),
      taskFile({
        id: "F-0200",
        title: "Valid closed",
        status: "done",
        closed_at: "2026-05-14T02:00:00-05:00",
      }),
    );
    await fs.writeFile(
      path.join(tasksDir, "missing-done-close.md"),
      taskFile({ id: "F-0201", title: "Missing done close", status: "done", closed_at: null }),
    );
    await fs.writeFile(
      path.join(tasksDir, "missing-canceled-close.md"),
      taskFile({
        id: "F-0202",
        title: "Missing canceled close",
        status: "canceled",
        closed_at: null,
      }),
    );
    await fs.writeFile(
      path.join(tasksDir, "open-with-close.md"),
      taskFile({
        id: "F-0203",
        title: "Open with close",
        status: "open",
        closed_at: "2026-05-14T02:00:00-05:00",
      }),
    );
    await fs.writeFile(
      path.join(tasksDir, "closed-before-create.md"),
      taskFile({
        id: "F-0204",
        title: "Closed before create",
        status: "done",
        closed_at: "2026-05-13T23:00:00-05:00",
      }),
    );

    const result = await run(repoRoot, ["doctor", "--json"]);
    const payload = parseStdoutJson(result);
    const diagnostics = payload.diagnostics.filter((diagnostic: any) =>
      ["missing_closed_at", "unexpected_closed_at", "closed_at_before_created_at"].includes(
        diagnostic.code,
      ),
    );

    expect(result.code).toBe(4);
    expect(diagnostics.map((diagnostic: any) => diagnostic.code).sort()).toEqual([
      "closed_at_before_created_at",
      "missing_closed_at",
      "missing_closed_at",
      "unexpected_closed_at",
    ]);
    expect(diagnostics.map((diagnostic: any) => diagnostic.taskId)).not.toContain("F-0200");
    for (const diagnostic of diagnostics) {
      expect(diagnostic.severity).toBe("error");
      expect(diagnostic.sourcePath).toContain(tasksDir);
      expect(diagnostic.repairHint).toEqual(expect.any(String));
    }
  });

  test("doctor --json reports parse, graph, conflict, block, and review diagnostics", async () => {
    const { repoRoot } = await makeRepo();
    const tasksDir = path.join(repoRoot, ".forge", "tasks");
    await fs.writeFile(path.join(tasksDir, "bad-missing-frontmatter.md"), "# Missing");
    await fs.writeFile(path.join(tasksDir, "bad-yaml.md"), "---\n:\n---\n");
    await fs.writeFile(
      path.join(tasksDir, "bad-status.md"),
      taskFile({ id: "F-0100", title: "Bad status", status: "ready" }),
    );
    await fs.writeFile(
      path.join(tasksDir, "bad-date.md"),
      taskFile({ id: "F-0101", title: "Bad date" }).replace(
        "updated_at: 2026-05-14T00:00:00-05:00",
        "updated_at: not-a-date",
      ),
    );
    await fs.writeFile(
      path.join(tasksDir, "conflict.md"),
      `${taskFile({ id: "F-0102", title: "Conflict" })}\n<<<<<<< ours\n=======\n>>>>>>> theirs\n`,
    );
    await fs.writeFile(
      path.join(tasksDir, "duplicate-a.md"),
      taskFile({ id: "F-0103", title: "Duplicate A" }),
    );
    await fs.writeFile(
      path.join(tasksDir, "duplicate-b.md"),
      taskFile({ id: "F-0103", title: "Duplicate B" }),
    );
    await fs.writeFile(
      path.join(tasksDir, "missing-dep.md"),
      taskFile({ id: "F-0104", title: "Missing dep", depends_on: ["F-9999"] }),
    );
    await fs.writeFile(
      path.join(tasksDir, "cycle-a.md"),
      taskFile({ id: "F-0105", title: "Cycle A", depends_on: ["F-0106"] }),
    );
    await fs.writeFile(
      path.join(tasksDir, "cycle-b.md"),
      taskFile({ id: "F-0106", title: "Cycle B", depends_on: ["F-0105"] }),
    );
    await fs.writeFile(
      path.join(tasksDir, "invalid-block-review.md"),
      taskFile({ id: "F-0107", title: "Invalid fields" }).replace(
        'claimed_by: ""',
        'blocked_by: []\nreview: requested\nclaimed_by: ""',
      ),
    );

    const result = await run(repoRoot, ["doctor", "--json"]);
    const payload = parseStdoutJson(result);
    const codes = payload.diagnostics.map((diagnostic: any) => diagnostic.code);

    expect(result.code).toBe(4);
    expect(payload.summary.errors).toBeGreaterThan(0);
    expect(codes).toContain("missing_frontmatter");
    expect(codes).toContain("malformed_yaml");
    expect(codes).toContain("invalid_enum");
    expect(codes).toContain("invalid_timestamp");
    expect(codes).toContain("merge_conflict_marker");
    expect(codes).toContain("duplicate_id");
    expect(codes).toContain("missing_dependency");
    expect(codes).toContain("dependency_cycle");
    expect(codes).toContain("invalid_block_field");
    expect(codes).toContain("invalid_review_field");
    expect(payload.diagnostics[0]).toHaveProperty("sourcePath");
  });

  test("doctor rejects non-json usage", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["doctor"]);
    const payload = parseStderrJson(result);

    expect(result.code).toBe(2);
    expect(payload.error.code).toBe("usage_error");
    expect(payload.error.message).toBe("usage: forge doctor --json");
  });

  test("output includes area when present", async () => {
    const { repoRoot } = await makeRepo();
    await fs.writeFile(
      path.join(repoRoot, ".forge", "tasks", "F-0004-area.md"),
      taskFile({ id: "F-0004", title: "Area", area: "cli" }),
    );

    const result = await run(repoRoot, ["list"]);

    expect(result.stdout).toContain("F-0004\topen\t-\tcli\tArea");
  });

  test("claim updates a task file", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    const result = await run(nestedDir, ["claim", "F-0002", "--by", "codex"]);

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["claimed F-0002 by codex"]);
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Open\n\nBody stays readable.\n");
  });

  test("claim defaults to USER", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    const result = await run(nestedDir, ["claim", "F-0002"]);

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result.code).toBe(0);
    expect(parsed.task.claimed_by).toBe("tester");
  });

  test("note appends stdin to the Notes section", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({
        id: "F-0002",
        title: "Open",
        depends_on: ["F-0001"],
        body: ["# Open", "", "## Notes", "", "Existing.", "", "## History", "", "- Created.", ""].join(
          "\n",
        ),
      }),
    );

    const result = await run(nestedDir, ["note", "F-0002", "--stdin"], "New note.");

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["noted F-0002"]);
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toContain("Existing.\n\nNew note.\n\n## History");
  });

  test("block, unblock, and review update lifecycle fields", async () => {
    const { nestedDir, taskPath } = await makeRepo();

    const blockResult = await run(nestedDir, [
      "block",
      "F-0002",
      "--reason",
      "Waiting on API",
    ]);
    let parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(blockResult.code).toBe(0);
    expect(blockResult.stdout).toEqual(["blocked F-0002"]);
    expect(parsed.task.status).toBe("blocked");
    expect(parsed.task.blocked_reason).toBe("Waiting on API");

    const reviewResult = await run(nestedDir, [
      "review",
      "F-0002",
      "--reason",
      "Needs human check",
    ]);
    parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(reviewResult.code).toBe(0);
    expect(reviewResult.stdout).toEqual(["review requested F-0002"]);
    expect(parsed.task.status).toBe("blocked");
    expect(parsed.task.review_reason).toBe("Needs human check");

    const unblockResult = await run(nestedDir, ["unblock", "F-0002"]);
    parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(unblockResult.code).toBe(0);
    expect(unblockResult.stdout).toEqual(["unblocked F-0002"]);
    expect(parsed.task.status).toBe("open");
    expect(parsed.task.blocked_reason).toBe("");
    expect(parsed.task.review_reason).toBe("Needs human check");
  });

  test("set updates metadata and returns the updated task bundle", async () => {
    const { nestedDir, taskPath } = await makeRepo();

    const result = await run(nestedDir, [
      "set",
      "F-0002",
      "--priority",
      "urgent",
      "--status",
      "blocked",
      "--area",
      "core",
      "--scope",
      "packages/core/**",
      "--scope",
      "docs:notes",
      "--json",
    ]);
    const payload = parseStdoutJson(result);
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(payload.task.title).toBe("Open");
    expect(payload.task.priority).toBe("urgent");
    expect(payload.task.status).toBe("blocked");
    expect(payload.task.area).toBe("core");
    expect(payload.task.scope).toEqual(["packages/core/**", "docs:notes"]);
    expect(parsed.task.priority).toBe("urgent");
    expect(parsed.task.status).toBe("blocked");
    expect(parsed.task.area).toBe("core");
    expect(parsed.task.scope).toEqual(["packages/core/**", "docs:notes"]);
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Open\n\nBody stays readable.\n");
  });

  test("set preserves unrelated frontmatter and unknown sections", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({
        id: "F-0002",
        title: "Open",
        depends_on: ["F-0001"],
        body: ["# Open", "", "## Extra", "", "Keep this.", ""].join("\n"),
      }).replace('claimed_by: ""', 'claimed_by: ""\ncustom_field: keep'),
    );

    const result = await run(nestedDir, ["set", "F-0002", "--area", "web", "--json"]);
    const contents = await fs.readFile(taskPath, "utf8");

    expect(result.code).toBe(0);
    expect(contents).toContain("custom_field: keep");
    expect(contents).toContain("## Extra\n\nKeep this.");
  });

  test("set updates close metadata", async () => {
    const { nestedDir, taskPath } = await makeRepo();

    const result = await run(nestedDir, [
      "set",
      "F-0002",
      "--closed-at",
      "2026-05-14T13:00:00Z",
      "--close-reason",
      "Historical repair",
      "--json",
    ]);
    const payload = parseStdoutJson(result);
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(payload.task.closed_at).toBe("2026-05-14T13:00:00.000Z");
    expect(payload.task.close_reason).toBe("Historical repair");
    expect(parsed.task.closed_at).toBe("2026-05-14T13:00:00.000Z");
    expect(parsed.task.close_reason).toBe("Historical repair");
    expect(parsed.task.body).toBe("\n# Open\n\nBody stays readable.\n");
  });

  test("set rejects invalid values and no-op usage", async () => {
    const { nestedDir } = await makeRepo();

    const invalidPriority = await run(nestedDir, [
      "set",
      "F-0002",
      "--priority",
      "highest",
      "--json",
    ]);
    const noFields = await run(nestedDir, ["set", "F-0002", "--json"]);
    const missingJson = await run(nestedDir, ["set", "F-0002", "--area", "web"]);
    const invalidTimestamp = await run(nestedDir, [
      "set",
      "F-0002",
      "--closed-at",
      "not-a-date",
      "--json",
    ]);

    expect(invalidPriority.code).toBe(2);
    expect(parseStderrJson(invalidPriority).error.message).toBe(
      "priority must be one of: urgent, high, medium, low",
    );
    expect(noFields.code).toBe(2);
    expect(parseStderrJson(noFields).error.message).toBe(
      "set requires at least one field to update",
    );
    expect(missingJson.code).toBe(2);
    expect(parseStderrJson(missingJson).error.message).toContain("usage: forge set");
    expect(invalidTimestamp.code).toBe(2);
    expect(parseStderrJson(invalidTimestamp).error.message).toBe(
      "closed_at must be a parseable timestamp",
    );
  });

  test("done updates a task file", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    await run(nestedDir, ["claim", "F-0002", "--by", "codex"]);

    const result = await run(nestedDir, ["done", "F-0002", "--reason", "Verified", "--json"]);
    const payload = parseStdoutJson(result);

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result.code).toBe(0);
    expect(payload.task.status).toBe("done");
    expect(payload.task.close_reason).toBe("Verified");
    expect(parsed.task.status).toBe("done");
    expect(parsed.task.claimed_by).toBe("");
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.closed_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.close_reason).toBe("Verified");
    expect(parsed.task.body).toBe("\n# Open\n\nBody stays readable.\n");
  });

  test("create writes a canonical task file", async () => {
    const { nestedDir, repoRoot } = await makeRepo();
    const result = await run(nestedDir, [
      "create",
      "F-0004",
      "--title",
      "Add task creation",
      "--why",
      "New tasks should start with the fields humans and tools expect.",
      "--success",
      "The CLI creates a ready-to-edit task document.",
      "--area",
      "cli",
      "--priority",
      "high",
      "--scope",
      "packages/cli/**",
      "--depends-on",
      "F-0002",
      "--acceptance",
      "The generated file has canonical Markdown sections.",
      "--verification",
      "bun test packages/cli",
    ]);

    const taskPath = path.join(
      repoRoot,
      ".forge",
      "tasks",
      "F-0004-add-task-creation.md",
    );
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("created F-0004");
    expect(parsed.task.title).toBe("Add task creation");
    expect(parsed.task.priority).toBe("high");
    expect(parsed.task.area).toBe("cli");
    expect(parsed.task.scope).toEqual(["packages/cli/**"]);
    expect(parsed.task.depends_on).toEqual(["F-0002"]);
    expect(parsed.task.created_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toContain("## Why");
    expect(parsed.task.body).toContain("## What success looks like");
    expect(parsed.task.body).toContain("## Acceptance Criteria");
    expect(parsed.task.body).toContain("## Dependencies");
    expect(parsed.task.body).toContain("## Verification");
    expect(parsed.task.body).toContain("## History");
  });

  test("create requires a title", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["create", "F-0004"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["create requires --title <title>"]);
  });

  test("prompt next prints a reusable agent prompt for the next ready task", async () => {
    const { nestedDir } = await makeRepo();
    const result = await run(nestedDir, ["prompt", "next"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toHaveLength(1);
    expect(result.stdout[0]).toContain("Goal: Complete Forge task F-0002 - Open");
    expect(result.stdout[0]).toContain("Before editing code or docs, claim the task.");
    expect(result.stdout[0]).toContain("Depends on: F-0001");
    expect(result.stdout[0]).toContain("- packages/**");
    expect(result.stdout[0]).toContain("Body stays readable.");
    expect(result.stdout[0]).toContain("Guidance:");
    expect(result.stdout[0]).toContain("No guidance matched.");
    expect(result.stdout[0]).toContain("no .forge/guidance.yml found");
  });

  test("prompt prints a reusable agent prompt for a specific task", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["prompt", "F-0003"]);

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("Goal: Complete Forge task F-0003 - Blocked");
    expect(result.stdout[0]).toContain("Depends on: F-0002");
  });

  test("prompt next includes matched guidance summaries", async () => {
    const { repoRoot } = await makeRepo();
    await writeGuidanceFixture(repoRoot);
    const result = await run(repoRoot, ["prompt", "next"]);

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("Goal: Complete Forge task F-0002 - Open");
    expect(result.stdout[0]).toContain("guidance/task.md");
    expect(result.stdout[0]).toContain("reasons: scope:packages/**");
    expect(result.stdout[0]).toContain("Task-scoped guidance.");
    expect(result.stdout[0]).not.toContain("# Task");
  });

  test("prompt explicit task includes matched guidance summaries", async () => {
    const { repoRoot } = await makeRepo();
    await writeGuidanceFixture(repoRoot);
    const result = await run(repoRoot, ["prompt", "F-0003"]);

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("Goal: Complete Forge task F-0003 - Blocked");
    expect(result.stdout[0]).toContain("guidance/task.md");
    expect(result.stdout[0]).toContain("Task-scoped guidance.");
  });

  test("prompt --full includes full matched guidance content", async () => {
    const { repoRoot } = await makeRepo();
    await writeGuidanceFixture(repoRoot);
    const result = await run(repoRoot, ["prompt", "F-0003", "--full"]);

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("guidance/task.md");
    expect(result.stdout[0]).toContain("# Task");
    expect(result.stdout[0]).toContain("## Prompt Summary");
  });

  test("prompt rejects invalid usage", async () => {
    const { repoRoot } = await makeRepo();

    expect(await run(repoRoot, ["prompt"])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge prompt <id|next> [--full]"],
    });
    expect(await run(repoRoot, ["prompt", "next", "--extra"])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge prompt <id|next> [--full]"],
    });
    expect(await run(repoRoot, ["prompt", "--full"])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge prompt <id|next> [--full]"],
    });
  });

  test("prompt next reports when no task is ready", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({ id: "F-0002", title: "Open", status: "doing", claimed_by: "codex" }),
    );
    const result = await run(repoRoot, ["prompt", "next"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["no ready tasks"]);
  });

  test("plan inserts an Execution Plan for a specific task", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({
        id: "F-0002",
        title: "Open",
        depends_on: ["F-0001"],
        body: [
          "# Open",
          "",
          "## Acceptance Criteria",
          "",
          "- The CLI creates a ready-to-edit task document.",
          "",
          "## Dependencies",
          "",
          "Depends on F-0001.",
          "",
        ].join("\n"),
      }),
    );
    const result = await run(
      repoRoot,
      ["plan", "F-0002", "--stdin"],
      "Summary: use the CLI helper.",
    );

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result).toMatchObject({ code: 0, stdout: ["planned F-0002"], stderr: [] });
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toContain(
      [
        "## Acceptance Criteria",
        "",
        "- The CLI creates a ready-to-edit task document.",
        "",
        "## Execution Plan",
        "",
        "Summary: use the CLI helper.",
        "",
        "## Dependencies",
      ].join("\n"),
    );
  });

  test("plan next updates the top ready task", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    const result = await run(nestedDir, ["plan", "next", "--stdin"], "Summary: next task.");

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result).toMatchObject({ code: 0, stdout: ["planned F-0002"], stderr: [] });
    expect(parsed.task.body).toContain("## Execution Plan\n\nSummary: next task.");
  });

  test("plan replaces an existing Execution Plan section", async () => {
    const { repoRoot, taskPath } = await makeRepo();
    await fs.writeFile(
      taskPath,
      taskFile({
        id: "F-0002",
        title: "Open",
        depends_on: ["F-0001"],
        body: [
          "# Open",
          "",
          "## Execution Plan",
          "",
          "Old plan.",
          "",
          "## Extra",
          "",
          "Keep this.",
          "",
        ].join("\n"),
      }),
    );

    const result = await run(repoRoot, ["plan", "F-0002", "--stdin"], "New plan.");
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(result.code).toBe(0);
    expect(parsed.task.body).not.toContain("Old plan.");
    expect(parsed.task.body).toContain("## Execution Plan\n\nNew plan.\n\n## Extra");
    expect(parsed.task.body).toContain("Keep this.");
  });

  test("plan rejects invalid usage and missing task states", async () => {
    const { repoRoot, taskPath } = await makeRepo();

    expect(await run(repoRoot, ["plan", "F-0002"], "Plan.")).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge plan <id|next> --stdin"],
    });
    expect(await run(repoRoot, ["plan", "F-0002", "--stdin"], "   ")).toEqual({
      code: 1,
      stdout: [],
      stderr: ["plan requires non-empty stdin"],
    });
    expect(await run(repoRoot, ["plan", "F-9999", "--stdin"], "Plan.")).toEqual({
      code: 1,
      stdout: [],
      stderr: ["task F-9999 not found"],
    });

    await fs.writeFile(
      taskPath,
      taskFile({ id: "F-0002", title: "Open", status: "doing", claimed_by: "codex" }),
    );
    expect(await run(repoRoot, ["plan", "next", "--stdin"], "Plan.")).toEqual({
      code: 1,
      stdout: [],
      stderr: ["no ready tasks"],
    });
  });

  test("loop-prompt prints the generic execution loop goal prompt", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["loop-prompt"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toHaveLength(1);
    expect(result.stdout[0]).toContain(
      "/goal Work the Forge execution loop until no ready task remains or a stop condition is hit.",
    );
    expect(result.stdout[0]).toContain("At the start of each iteration, use `forge prompt next`");
    expect(result.stdout[0]).toContain("After committing, start the next iteration");
    expect(result.stdout[0]).toContain("Commit the code and task-file updates together.");
  });

  test("loop-prompt rejects extra args", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["loop-prompt", "next"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["usage: forge loop-prompt"]);
  });

  test("web validates the port before starting the server", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["web", "--port", "nope"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["web option --port requires a valid port"]);
  });

  test("unknown task id exits nonzero with a useful message", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["claim", "F-9999", "--by", "codex"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["task F-9999 not found"]);
  });
});
