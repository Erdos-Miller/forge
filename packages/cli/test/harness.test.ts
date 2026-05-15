import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTaskFile } from "@forge/core";
import { runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

interface RunResult {
  code: number;
  stdout: string[];
  stderr: string[];
}

interface TaskFixture {
  id: string;
  title?: string;
  status?: "open" | "doing" | "blocked" | "done" | "canceled";
  priority?: "urgent" | "high" | "medium" | "low";
  claimed_by?: string;
  depends_on?: string[];
}

async function makeRepo(prefix = "forge-harness-test-") {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(repoRoot);
  await fs.mkdir(path.join(repoRoot, ".forge", "tasks"), { recursive: true });
  return repoRoot;
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

function parseStdoutJson(result: RunResult): any {
  expect(result.stdout).toHaveLength(1);
  return JSON.parse(result.stdout[0]);
}

async function writeTask(repoRoot: string, fixture: TaskFixture): Promise<string> {
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const filePath = path.join(tasksDir, `${fixture.id}-${slugify(fixture.title ?? fixture.id)}.md`);
  await fs.writeFile(filePath, taskFile(fixture));
  return filePath;
}

async function writeTasks(
  repoRoot: string,
  fixtures: TaskFixture[],
  batchSize = 200,
): Promise<void> {
  for (let index = 0; index < fixtures.length; index += batchSize) {
    await Promise.all(fixtures.slice(index, index + batchSize).map((fixture) => writeTask(repoRoot, fixture)));
  }
}

function taskFile(fixture: TaskFixture): string {
  const status = fixture.status ?? "open";
  const dependsOn = fixture.depends_on?.length
    ? "\n" + fixture.depends_on.map((id) => `  - ${id}`).join("\n")
    : " []";
  const closedFields =
    status === "done" || status === "canceled"
      ? [
          "closed_at: 2026-05-15T01:00:00-05:00",
          `close_reason: ${JSON.stringify("Fixture closed")}`,
        ]
      : ["closed_at: \"\"", "close_reason: \"\""];

  return [
    "---",
    `id: ${fixture.id}`,
    `title: ${JSON.stringify(fixture.title ?? fixture.id)}`,
    "kind: task",
    `status: ${status}`,
    `priority: ${fixture.priority ?? "medium"}`,
    'parent: ""',
    `depends_on:${dependsOn}`,
    `claimed_by: ${JSON.stringify(fixture.claimed_by ?? "")}`,
    "area: harness",
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-15T00:00:00-05:00",
    "updated_at: 2026-05-15T00:00:00-05:00",
    ...closedFields,
    'blocked_reason: ""',
    'review_reason: ""',
    "---",
    "",
    `# ${fixture.title ?? fixture.id}`,
    "",
    "## Notes",
    "",
    "Harness fixture.",
    "",
  ].join("\n");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fixtures(count: number): TaskFixture[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `F-${String(index + 1).padStart(5, "0")}`;
    return {
      id,
      title: `Harness task ${index + 1}`,
      priority: index % 4 === 0 ? "urgent" : index % 4 === 1 ? "high" : index % 4 === 2 ? "medium" : "low",
    };
  });
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
    const repoRoot = await makeRepo();

    const createResult = await run(repoRoot, [
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
      await run(repoRoot, ["next", "--claim", "--by", "codex", "--json"]),
    );
    expect(claimedPayload).toMatchObject({
      reason: "claimed",
      task: { id: "F-0001", status: "doing", claimed_by: "codex" },
    });

    const createdPath = path.join(repoRoot, ".forge", "tasks", "F-0001-harness-workflow.md");
    let parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("doing");
    expect(parsed.task.claimed_by).toBe("codex");

    expect(await run(repoRoot, ["note", "F-0001", "--stdin"], "Decision: exercise the full loop.")).toMatchObject({
      code: 0,
      stderr: [],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.body).toContain("Decision: exercise the full loop.");

    expect(await run(repoRoot, ["block", "F-0001", "--reason", "Waiting on fixture"])).toMatchObject({
      code: 0,
      stdout: ["blocked F-0001"],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("blocked");
    expect(parsed.task.blocked_reason).toBe("Waiting on fixture");

    expect(await run(repoRoot, ["unblock", "F-0001"])).toMatchObject({
      code: 0,
      stdout: ["unblocked F-0001"],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.status).toBe("open");
    expect(parsed.task.blocked_reason).toBe("");

    expect(await run(repoRoot, ["review", "F-0001", "--reason", "Needs harness review"])).toMatchObject({
      code: 0,
      stdout: ["review requested F-0001"],
    });
    parsed = parseTaskFile(createdPath, await fs.readFile(createdPath, "utf8"));
    expect(parsed.task.review_reason).toBe("Needs harness review");

    const donePayload = parseStdoutJson(
      await run(repoRoot, ["done", "F-0001", "--reason", "Harness verified", "--json"]),
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

    expect(parseStdoutJson(await run(repoRoot, ["doctor", "--json"]))).toMatchObject({
      summary: { errors: 0, warnings: 0 },
    });
  });

  test("covers graph fixtures for dependency shapes and diagnostics", async () => {
    const repoRoot = await makeRepo();
    await writeTasks(repoRoot, [
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

  test("keeps 1k task queue and doctor performance within an explicit budget", async () => {
    const repoRoot = await makeRepo("forge-harness-1k-");
    await writeTasks(repoRoot, fixtures(1000));

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
    const repoRoot = await makeRepo("forge-harness-10k-");
    await writeTasks(repoRoot, fixtures(10000));

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
