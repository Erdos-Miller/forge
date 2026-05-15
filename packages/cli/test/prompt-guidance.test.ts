import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { COMMANDS, runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<{ repoRoot: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-prompt-guidance-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(
    path.join(tasksDir, "F-0001-open.md"),
    [
      "---",
      "id: F-0001",
      "title: Open",
      "kind: task",
      "status: open",
      "priority: high",
      'parent: ""',
      "depends_on: []",
      'claimed_by: ""',
      "scope:",
      "  - packages/**",
      "created_at: 2026-05-14T00:00:00-05:00",
      "updated_at: 2026-05-14T00:00:00-05:00",
      "---",
      "",
      "# Open",
      "",
    ].join("\n"),
  );
  return { repoRoot };
}

async function run(cwd: string, args: string[]): Promise<string> {
  const stdout: string[] = [];
  const code = await runCli(args, {
    cwd,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });

  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  return stdout[0];
}

describe("prompt command guidance", () => {
  test("prompt includes generated command guidance from metadata", async () => {
    const { repoRoot } = await makeRepo();
    const output = await run(repoRoot, ["prompt", "next"]);

    expect(output).toContain("Command guidance:");
    expect(output).toContain("Prefer structured Forge commands");
    expect(output).toContain("Direct Markdown edits are acceptable");
    for (const command of COMMANDS) {
      expect(output).toContain(command.usage);
    }
  });

  test("loop-prompt includes generated command guidance from metadata", async () => {
    const { repoRoot } = await makeRepo();
    const output = await run(repoRoot, ["loop-prompt"]);

    expect(output).toContain("Command guidance:");
    for (const command of COMMANDS) {
      expect(output).toContain(command.usage);
    }
  });
});
