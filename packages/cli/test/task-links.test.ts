import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src";
import {
  writeWebSession,
  writeWorkspaceWebSessions,
} from "../src/web-session";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-task-links-"));
  tempDirs.push(repoRoot);

  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(
    path.join(tasksDir, "F-0001-open.md"),
    taskFile("F-0001", "Open", "open"),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-0002-done.md"),
    taskFile("F-0002", "Done", "done"),
  );
  return repoRoot;
}

function taskFile(id: string, title: string, status: "open" | "done"): string {
  const closedAt = status === "done" ? ["closed_at: 2026-05-14T00:00:00Z"] : [];
  return [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    "kind: task",
    `status: ${status}`,
    "priority: high",
    'parent: ""',
    "depends_on: []",
    'claimed_by: ""',
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-14T00:00:00Z",
    "updated_at: 2026-05-14T00:00:00Z",
    ...closedAt,
    "---",
    "",
    `# ${title}`,
    "",
  ].join("\n");
}

async function run(
  cwd: string,
  args: string[],
  options: {
    env?: Record<string, string | undefined>;
    stdoutIsTTY?: boolean;
  } = {},
): Promise<{ code: number; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    env: { USER: "tester", ...options.env },
    now: new Date("2026-05-14T12:00:00Z"),
    stdoutIsTTY: options.stdoutIsTTY ?? false,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { code, stdout, stderr };
}

async function writeLiveSession(repoRoot: string): Promise<void> {
  await writeWebSession(repoRoot, {
    host: "127.0.0.1",
    port: 5199,
    pid: process.pid,
    startedAt: "2026-05-14T12:00:00.000Z",
  });
}

async function makeWorkspace(): Promise<{
  workspaceRoot: string;
  firstRoot: string;
  secondRoot: string;
}> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-task-links-workspace-"));
  tempDirs.push(workspaceRoot);
  const firstRoot = path.join(workspaceRoot, "alpha");
  const secondRoot = path.join(workspaceRoot, "beta");
  await fs.mkdir(firstRoot, { recursive: true });
  await fs.mkdir(secondRoot, { recursive: true });
  await writeFixtureRepo(firstRoot, "F-0001", "Alpha task");
  await writeFixtureRepo(secondRoot, "F-0002", "Beta task");
  await writeWorkspaceWebSessions(
    [
      { id: "alpha", displayName: "alpha", path: firstRoot },
      { id: "beta", displayName: "beta", path: secondRoot },
    ],
    {
      host: "127.0.0.1",
      port: 5199,
      pid: process.pid,
      startedAt: "2026-05-14T12:00:00.000Z",
    },
  );
  return { workspaceRoot, firstRoot, secondRoot };
}

async function writeFixtureRepo(repoRoot: string, id: string, title: string): Promise<void> {
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(path.join(tasksDir, `${id}-open.md`), taskFile(id, title, "open"));
}

function parseStdoutJson(result: { stdout: string[] }): any {
  expect(result.stdout).toHaveLength(1);
  return JSON.parse(result.stdout[0]);
}

function osc8Link(url: string, text: string): string {
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}

describe("task terminal links", () => {
  test("links task ids when requested and a live session exists", async () => {
    const repoRoot = await makeRepo();
    await writeLiveSession(repoRoot);

    const result = await run(repoRoot, ["list", "--links=always"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      `${osc8Link("http://127.0.0.1:5199/?task=F-0001", "F-0001")}\topen\t-\tOpen`,
    ]);
  });

  test("links through a workspace server when the current root is indexed", async () => {
    const { secondRoot } = await makeWorkspace();

    const result = await run(secondRoot, ["list", "--links=always"]);

    expect(result.code).toBe(0);
    const linkedTaskId = osc8Link(
      "http://127.0.0.1:5199/?repo=beta&task=F-0002",
      "F-0002",
    );
    expect(result.stdout).toEqual([
      `${linkedTaskId}\topen\t-\tBeta task`,
    ]);
  });

  test("auto links require TTY output and a live session", async () => {
    const repoRoot = await makeRepo();
    await writeLiveSession(repoRoot);

    expect((await run(repoRoot, ["ready"])).stdout).toEqual(["F-0001\topen\t-\tOpen"]);
    expect((await run(repoRoot, ["ready"], { stdoutIsTTY: true })).stdout).toEqual([
      `${osc8Link("http://127.0.0.1:5199/?task=F-0001", "F-0001")}\topen\t-\tOpen`,
    ]);
  });

  test("disabled and missing-session modes fall back to plain task ids", async () => {
    const repoRoot = await makeRepo();
    await writeLiveSession(repoRoot);

    expect((await run(repoRoot, ["list", "--links=never"], { stdoutIsTTY: true })).stdout)
      .toEqual(["F-0001\topen\t-\tOpen"]);

    await fs.rm(path.join(repoRoot, ".forge", "local", "web-session.json"));
    expect((await run(repoRoot, ["list", "--links=always"])).stdout).toEqual([
      "F-0001\topen\t-\tOpen",
    ]);
  });

  test("json output is unchanged by link env overrides", async () => {
    const repoRoot = await makeRepo();
    const plain = parseStdoutJson(await run(repoRoot, ["queue", "--json"]));
    const linkedEnv = parseStdoutJson(await run(repoRoot, ["queue", "--json"], {
      env: { FORGE_WEB_URL: "http://127.0.0.1:5199/" },
      stdoutIsTTY: true,
    }));

    expect(linkedEnv).toEqual(plain);
    expect(JSON.stringify(linkedEnv)).not.toContain("\u001B]8;;");
  });

  test("json output is unchanged by workspace sessions", async () => {
    const { secondRoot } = await makeWorkspace();
    const plain = parseStdoutJson(await run(secondRoot, ["queue", "--json"]));
    const tty = parseStdoutJson(
      await run(secondRoot, ["queue", "--json"], { stdoutIsTTY: true }),
    );

    expect(tty).toEqual(plain);
    expect(JSON.stringify(tty)).not.toContain("\u001B]8;;");
  });
});
