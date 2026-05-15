import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseTaskFile } from "@forge/core";
import {
  blockedForgeFixtureTasks,
  claimedForgeFixtureTasks,
  createForgeFixtureRepo,
  doneForgeFixtureTasks,
  legacyForgeFixtureTasks,
  scaleForgeFixtureTasks,
  type ForgeFixtureRepo,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";

const fixtureRepos: ForgeFixtureRepo[] = [];
const cliEntrypoint = path.resolve(import.meta.dir, "..", "src", "index.ts");

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

interface RunResult {
  code: number;
  stdout: string[];
  stderr: string[];
}

async function makeRepo(prefix = "forge-harness-test-"): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({ prefix });
  fixtureRepos.push(repo);
  return repo;
}

async function run(cwd: string, args: string[], stdin = ""): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    env: { USER: "harness" },
    now: new Date("2026-05-15T12:00:00Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    stdin: async () => stdin,
  });

  return { code, stdout, stderr };
}

async function runEntrypoint(cwd: string, args: string[]): Promise<RunResult> {
  const proc = Bun.spawn(["bun", cliEntrypoint, ...args], {
    cwd,
    env: { ...process.env, USER: "harness" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return {
    code,
    stdout: splitOutputLines(stdout),
    stderr: splitOutputLines(stderr),
  };
}

function parseStdoutJson(result: RunResult): any {
  expect(result.stdout).toHaveLength(1);
  return JSON.parse(result.stdout[0]);
}

function splitOutputLines(output: string): string[] {
  const trimmed = output.trimEnd();
  return trimmed ? trimmed.split("\n") : [];
}

async function measure(label: string, action: () => Promise<RunResult>) {
  const start = performance.now();
  const result = await action();
  const elapsedMs = performance.now() - start;
  console.info(`${label}: ${elapsedMs.toFixed(1)}ms`);
  return { result, elapsedMs };
}

describe("Forge agent harness scenarios", () => {
  test("runs a full robot workflow against an isolated temp repo", async () => {
    const { repoRoot, nestedDir } = await makeRepo();

    const createResult = await run(nestedDir, [
      "create",
      "F-0001",
      "--title",
      "Harness workflow",
      "--priority",
      "high",
      "--area",
      "harness",
      "--scope",
      "packages/**",
    ]);
    expect(createResult).toMatchObject({ code: 0, stderr: [] });

    const queuePayload = parseStdoutJson(await run(repoRoot, ["queue", "--json"]));
    expect(queuePayload.tasks.map((task: any) => task.id)).toEqual(["F-0001"]);

    const claimedPayload = parseStdoutJson(
      await run(nestedDir, ["next", "--claim", "--by", "codex", "--json"]),
    );
    expect(claimedPayload).toMatchObject({
      reason: "claimed",
      task: { id: "F-0001", status: "doing", claimed_by: "codex" },
    });

    const createdPath = path.join(repoRoot, ".forge", "tasks", "F-0001-harness-workflow.md");
    let parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");

    expect(await run(nestedDir, ["note", "F-0001", "--stdin"], "Decision: exercise the full loop.")).toMatchObject({
      code: 0,
      stderr: [],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.body).toContain("Decision: exercise the full loop.");

    expect(await run(nestedDir, ["block", "F-0001", "--reason", "Waiting on fixture"])).toMatchObject({
      code: 0,
      stdout: ["blocked F-0001"],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("blocked");
    expect(parsed.task.blocked_reason).toBe("Waiting on fixture");

    expect(await run(nestedDir, ["unblock", "F-0001"])).toMatchObject({
      code: 0,
      stdout: ["unblocked F-0001"],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("open");
    expect(parsed.task.blocked_reason).toBe("");

    expect(await run(nestedDir, ["review", "F-0001", "--reason", "Needs harness review"])).toMatchObject({
      code: 0,
      stdout: ["review requested F-0001"],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.review_reason).toBe("Needs harness review");

    const donePayload = parseStdoutJson(
      await run(nestedDir, ["done", "F-0001", "--reason", "Harness verified", "--json"]),
    );
    expect(donePayload.task).toMatchObject({
      id: "F-0001",
      status: "done",
      claimed_by: null,
      close_reason: "Harness verified",
    });

    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("done");
    expect(parsed.task.claimed_by).toBe("");
    expect(parsed.task.blocked_reason).toBe("");
    expect(parsed.task.review_reason).toBe("");
    expect(parsed.task.closed_at).toBe("2026-05-15T12:00:00.000Z");
    expect(parsed.task.body).toContain("Decision: exercise the full loop.");

    expect(parseStdoutJson(await run(nestedDir, ["doctor", "--json"]))).toMatchObject({
      summary: { errors: 0, warnings: 0 },
    });
  });

  test("runs read and selection commands through the real entrypoint from root and nested cwd", async () => {
    const repo = await makeRepo();
    const realRepoRoot = await fs.realpath(repo.repoRoot);
    await repo.writeTasks([
      { id: "F-0001", title: "Finished base", status: "done" },
      { id: "F-0002", title: "Ready harness task", priority: "high", depends_on: ["F-0001"] },
      { id: "F-0003", title: "Blocked follow-up", depends_on: ["F-0002"] },
      { id: "F-0004", title: "Claimed task", claimed_by: "codex" },
    ]);

    const rootList = await runEntrypoint(repo.repoRoot, ["list"]);
    const nestedList = await runEntrypoint(repo.nestedDir, ["list"]);
    expect(rootList).toEqual(nestedList);
    expect(rootList.stdout).toEqual([
      "F-0002\topen\t-\tharness\tReady harness task",
      "F-0003\topen\t-\tharness\tBlocked follow-up",
      "F-0004\topen\tcodex\tharness\tClaimed task",
    ]);

    const rootReady = await runEntrypoint(repo.repoRoot, ["ready"]);
    const nestedReady = await runEntrypoint(repo.nestedDir, ["ready"]);
    expect(rootReady).toEqual(nestedReady);
    expect(rootReady.stdout).toEqual([
      "F-0002\topen\t-\tharness\tReady harness task",
    ]);

    for (const cwd of [repo.repoRoot, repo.nestedDir]) {
      const queuePayload = parseStdoutJson(await runEntrypoint(cwd, ["queue", "--json"]));
      expect(queuePayload.repoRoot).toBe(realRepoRoot);
      expect(queuePayload.tasks.map((task: any) => task.id)).toEqual(["F-0002"]);

      const nextPayload = parseStdoutJson(await runEntrypoint(cwd, ["next", "--json"]));
      expect(nextPayload).toMatchObject({
        reason: "ready",
        task: { id: "F-0002", title: "Ready harness task" },
      });

      const promptResult = await runEntrypoint(cwd, ["prompt", "next"]);
      expect(promptResult).toMatchObject({ code: 0, stderr: [] });
      expect(promptResult.stdout.join("\n")).toContain(
        "Goal: Complete Forge task F-0002 - Ready harness task",
      );

      expect(parseStdoutJson(await runEntrypoint(cwd, ["doctor", "--json"]))).toMatchObject({
        summary: { errors: 0, warnings: 0 },
      });
    }
  });

  test("covers graph fixtures for dependency shapes and diagnostics", async () => {
    const repo = await makeRepo();
    const repoRoot = repo.repoRoot;
    await repo.writeTasks([
      { id: "F-0101", title: "Linear base", status: "done" },
      { id: "F-0102", title: "Linear ready", depends_on: ["F-0101"] },
      { id: "F-0201", title: "Fan in left", status: "done" },
      { id: "F-0202", title: "Fan in right", status: "done" },
      { id: "F-0203", title: "Fan in ready", depends_on: ["F-0201", "F-0202"] },
      { id: "F-0301", title: "Fan out source" },
      { id: "F-0302", title: "Fan out child A", depends_on: ["F-0301"] },
      { id: "F-0303", title: "Fan out child B", depends_on: ["F-0301"] },
      { id: "F-0401", title: "Missing dependency", depends_on: ["F-9999"] },
      { id: "F-0501", title: "Cycle one", depends_on: ["F-0502"] },
      { id: "F-0502", title: "Cycle two", depends_on: ["F-0501"] },
      { id: "F-0601", title: "Claimed", claimed_by: "codex" },
    ]);

    const queuePayload = parseStdoutJson(await run(repoRoot, ["queue", "--json"]));
    expect(queuePayload.tasks.map((task: any) => task.id)).toEqual([
      "F-0301",
      "F-0102",
      "F-0203",
    ]);
    expect(queuePayload.tasks.find((task: any) => task.id === "F-0301").reasons).toContainEqual({
      kind: "downstream_unblock_count",
      count: 2,
    });
    expect(queuePayload.diagnostics.missingDependencies).toEqual([
      { taskId: "F-0401", dependencyId: "F-9999" },
    ]);
    expect(queuePayload.diagnostics.dependencyCycles).toEqual([
      { taskIds: ["F-0501", "F-0502", "F-0501"] },
    ]);

    expect(parseStdoutJson(await run(repoRoot, ["blockers", "F-0302", "--json"])).blockers).toEqual([
      {
        kind: "dependency_status",
        message: "dependency F-0301 is open",
        taskId: "F-0302",
        dependencyId: "F-0301",
      },
    ]);
    expect(parseStdoutJson(await run(repoRoot, ["blockers", "F-0401", "--json"])).blockers).toEqual([
      {
        kind: "missing_dependency",
        message: "missing dependency F-9999",
        taskId: "F-0401",
        dependencyId: "F-9999",
      },
    ]);
    expect(parseStdoutJson(await run(repoRoot, ["blockers", "F-0501", "--json"])).blockers).toEqual([
      {
        kind: "dependency_status",
        message: "dependency F-0502 is open",
        taskId: "F-0501",
        dependencyId: "F-0502",
      },
      {
        kind: "cycle",
        message: "dependency cycle: F-0501 -> F-0502 -> F-0501",
        taskId: "F-0501",
        taskIds: ["F-0501", "F-0502", "F-0501"],
      },
    ]);
    expect(parseStdoutJson(await run(repoRoot, ["blockers", "F-0601", "--json"])).blockers).toEqual([]);
  });

  test("reports malformed fixture repos with useful doctor diagnostics", async () => {
    const repo = await makeRepo();
    const realTasksDir = await fs.realpath(repo.tasksDir);
    await fs.writeFile(path.join(repo.tasksDir, "bad-missing-frontmatter.md"), "# Missing");
    await fs.writeFile(path.join(repo.tasksDir, "bad-yaml.md"), "---\n:\n---\n");
    await fs.writeFile(
      path.join(repo.tasksDir, "bad-status.md"),
      [
        "---",
        "id: F-0901",
        'title: "Invalid status"',
        "kind: task",
        "status: ready",
        "priority: high",
        "---",
        "",
        "# Invalid status",
        "",
      ].join("\n"),
    );

    const result = await runEntrypoint(repo.nestedDir, ["doctor", "--json"]);
    const payload = parseStdoutJson(result);
    const diagnosticsByCode = new Map(
      payload.diagnostics.map((diagnostic: any) => [diagnostic.code, diagnostic]),
    );

    expect(result.code).toBe(4);
    expect(payload.summary.errors).toBe(3);
    expect(diagnosticsByCode.get("missing_frontmatter")).toMatchObject({
      severity: "error",
      sourcePath: path.join(realTasksDir, "bad-missing-frontmatter.md"),
    });
    expect(diagnosticsByCode.get("malformed_yaml")).toMatchObject({
      severity: "error",
      sourcePath: path.join(realTasksDir, "bad-yaml.md"),
    });
    expect(diagnosticsByCode.get("invalid_enum")).toMatchObject({
      severity: "error",
      sourcePath: path.join(realTasksDir, "bad-status.md"),
    });
    expect(payload.diagnostics.map((diagnostic: any) => diagnostic.message).join("\n")).toContain(
      "must be one of",
    );
  });

  test("reuses shared fixture shapes for task store edge cases", async () => {
    const repo = await makeRepo();
    await repo.writeTasks([
      ...blockedForgeFixtureTasks(),
      ...claimedForgeFixtureTasks(),
      ...doneForgeFixtureTasks(),
      ...legacyForgeFixtureTasks(),
    ]);

    const queuePayload = parseStdoutJson(await run(repo.repoRoot, ["queue", "--json"]));
    expect(queuePayload.tasks.map((task: any) => task.id)).toEqual(["F-0101", "F-0401"]);

    const doctorPayload = parseStdoutJson(await run(repo.nestedDir, ["doctor", "--json"]));
    expect(doctorPayload.summary).toEqual({ errors: 0, warnings: 0 });
  });

  test("keeps 1k task queue and doctor performance within an explicit budget", async () => {
    const repo = await makeRepo("forge-harness-1k-");
    const repoRoot = repo.repoRoot;
    await repo.writeTasks(scaleForgeFixtureTasks(1000));

    const queue = await measure("1k queue", () => run(repoRoot, ["queue", "--json"]));
    expect(queue.result.code).toBe(0);
    expect(parseStdoutJson(queue.result).tasks).toHaveLength(1000);
    expect(queue.elapsedMs).toBeLessThan(2000);

    const doctor = await measure("1k doctor", () => run(repoRoot, ["doctor", "--json"]));
    expect(doctor.result.code).toBe(0);
    expect(parseStdoutJson(doctor.result).summary).toEqual({ errors: 0, warnings: 0 });
    expect(doctor.elapsedMs).toBeLessThan(2000);
  });

  test("reports 10k task queue and doctor measurements with an extreme upper bound", async () => {
    const repo = await makeRepo("forge-harness-10k-");
    const repoRoot = repo.repoRoot;
    await repo.writeTasks(scaleForgeFixtureTasks(10000));

    const queue = await measure("10k queue", () => run(repoRoot, ["queue", "--json"]));
    expect(queue.result.code).toBe(0);
    expect(parseStdoutJson(queue.result).tasks).toHaveLength(10000);
    expect(queue.elapsedMs).toBeLessThan(30000);

    const doctor = await measure("10k doctor", () => run(repoRoot, ["doctor", "--json"]));
    expect(doctor.result.code).toBe(0);
    expect(parseStdoutJson(doctor.result).summary).toEqual({ errors: 0, warnings: 0 });
    expect(doctor.elapsedMs).toBeLessThan(30000);
  });
});
