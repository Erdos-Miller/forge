import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTaskFile } from "@forge/core";
import { runCli } from "../src";

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
}): string {
  const dependsOn = options.depends_on?.length
    ? options.depends_on.map((id) => `  - ${id}`).join("\n")
    : "[]";
  const area = options.area ? [`area: ${options.area}`] : [];

  return [
    "---",
    `id: ${options.id}`,
    `title: ${options.title}`,
    "kind: task",
    `status: ${options.status ?? "open"}`,
    "priority: medium",
    ...area,
    'parent: ""',
    `depends_on: ${dependsOn === "[]" ? "[]" : "\n" + dependsOn}`,
    `claimed_by: ${JSON.stringify(options.claimed_by ?? "")}`,
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    "---",
    "",
    `# ${options.title}`,
    "",
    "Body stays readable.",
    "",
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

async function run(
  cwd: string,
  args: string[],
): Promise<{ code: number; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    env: { USER: "tester" },
    now: new Date("2026-05-14T12:00:00Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });

  return { code, stdout, stderr };
}

describe("forge cli", () => {
  test("list prints all tasks", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["list"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("F-0001\tdone\t-\tDone");
    expect(result.stdout).toContain("F-0002\topen\t-\tOpen");
    expect(result.stdout).toContain("F-0003\topen\t-\tBlocked");
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
    expect((await run(nestedDir, ["ready"])).stdout).toEqual([
      "F-0002\topen\t-\tOpen",
    ]);
  });

  test("list and ready reject unexpected extra args", async () => {
    const { repoRoot } = await makeRepo();

    expect(await run(repoRoot, ["list", "--cwd", repoRoot])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge list"],
    });
    expect(await run(repoRoot, ["ready", "--cwd", repoRoot])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["usage: forge ready"],
    });
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

  test("done updates a task file", async () => {
    const { nestedDir, taskPath } = await makeRepo();
    await run(nestedDir, ["claim", "F-0002", "--by", "codex"]);

    const result = await run(nestedDir, ["done", "F-0002"]);

    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["done F-0002"]);
    expect(parsed.task.status).toBe("done");
    expect(parsed.task.claimed_by).toBe("");
    expect(parsed.task.updated_at).toBe("2026-05-14T12:00:00.000Z");
    expect(parsed.task.body).toBe("\n# Open\n\nBody stays readable.\n");
  });

  test("unknown task id exits nonzero with a useful message", async () => {
    const { repoRoot } = await makeRepo();
    const result = await run(repoRoot, ["claim", "F-9999", "--by", "codex"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["task F-9999 not found"]);
  });
});
