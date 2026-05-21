import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { COMMANDS, runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(body = ""): Promise<{ repoRoot: string }> {
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
      body,
    ].join("\n"),
  );
  return { repoRoot };
}

async function run(
  cwd: string,
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<string> {
  const stdout: string[] = [];
  const code = await runCli(args, {
    cwd,
    env: { ...process.env, ...env },
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
    expect(output).toContain("Edit scope:");
    expect(output).not.toContain("\nScope:\n");
    expect(output).toContain("Prefer structured Forge commands");
    expect(output).toContain("Direct Markdown edits are acceptable");
    expect(output).toContain("Use Project for task organization");
    expect(output).toContain('forge create "Title" --project <id> --area <area>');
    expect(output).toContain("cwd can infer Project");
    expect(output).toContain("task scope only as an edit-boundary refinement");
    expect(output).toContain("forge worktree-status --json");
    expect(output).toContain("continue on `non_blocking`");
    expect(output).toContain("pause on `review`");
    expect(output).toContain("stop on `blocking`");
    expect(output).toContain("changes conventions, architecture, or public semantics");
    expect(output).toContain("durable repo documentation");
    expect(output).toContain("repo-local testing or harness guidance");
    expect(output).toContain("bun run harness:web:layout");
    expect(output).toContain("before changing layout CSS");
    expect(output).toContain("bun run harness:web");
    expect(output).toContain("bun run harness:cli");
    expect(output).toContain("bun run harness:check");
    for (const command of COMMANDS) {
      expect(output).toContain(command.usage);
    }
  });

  test("prompt renders expected fields before supporting task details", async () => {
    const { repoRoot } = await makeRepo(
      [
        "## Dependencies",
        "",
        "Tracked in frontmatter.",
        "",
        "## Verification",
        "",
        "- bun test",
        "",
        "## Why",
        "",
        "Explain the reason.",
        "",
        "## What success looks like",
        "",
        "The outcome is obvious.",
        "",
        "## Acceptance Criteria",
        "",
        "- Expected fields are first.",
        "",
        "## Notes",
        "",
        "Keep this visible.",
        "",
        "## Extra",
        "",
        "Still visible.",
      ].join("\n"),
    );
    const output = await run(repoRoot, ["prompt", "next"]);

    expect(output).toContain("Task brief:");
    expect(output).toContain("Supporting task details:");
    expect(output.indexOf("## Why")).toBeLessThan(output.indexOf("## What success looks like"));
    expect(output.indexOf("## What success looks like")).toBeLessThan(
      output.indexOf("## Acceptance Criteria"),
    );
    expect(output.indexOf("## Acceptance Criteria")).toBeLessThan(
      output.indexOf("## Verification"),
    );
    expect(output.indexOf("## Verification")).toBeLessThan(output.indexOf("## Notes"));
    expect(output.indexOf("## Notes")).toBeLessThan(output.indexOf("Supporting task details:"));
    expect(output.indexOf("Supporting task details:")).toBeLessThan(
      output.indexOf("## Dependencies"),
    );
    expect(output.indexOf("## Extra")).toBeLessThan(output.indexOf("Command guidance:"));
  });

  test("loop-prompt includes generated command guidance from metadata", async () => {
    const { repoRoot } = await makeRepo();
    const output = await run(repoRoot, ["loop-prompt"]);

    expect(output).toContain("Command guidance:");
    expect(output).toContain("classify it with `forge worktree-status --json`");
    expect(output).toContain("task edit scope");
    expect(output).toContain("Use Project for task organization");
    expect(output).toContain("cwd can infer Project");
    expect(output).toContain("exceed edit scope");
    expect(output).toContain("continue on `non_blocking`");
    expect(output).toContain("pause on `review`");
    expect(output).toContain("stop on `blocking`");
    expect(output).toContain("changes conventions, architecture, or public semantics");
    expect(output).toContain("durable repo documentation before closeout");
    expect(output).toContain("repo-local testing or harness guidance");
    expect(output).toContain("bun run harness:web:layout");
    expect(output).toContain("before changing layout CSS");
    expect(output).toContain("bun run harness:web");
    expect(output).toContain("bun run harness:cli");
    expect(output).toContain("bun run harness:check");
    for (const command of COMMANDS) {
      expect(output).toContain(command.usage);
    }
  });

  test("prompts include personal user guidance when configured", async () => {
    const { repoRoot } = await makeRepo();
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "forge-prompt-user-guidance-"));
    tempDirs.push(home);
    await fs.mkdir(path.join(home, ".config", "forge"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".config", "forge", "guidance.md"),
      "Use short verification notes.\n",
    );

    const taskPrompt = await run(repoRoot, ["prompt", "next"], { HOME: home });
    const loopPrompt = await run(repoRoot, ["loop-prompt"], { HOME: home });

    expect(taskPrompt).toContain("Personal user guidance:");
    expect(taskPrompt).toContain("Use short verification notes.");
    expect(loopPrompt).toContain("Personal user guidance:");
    expect(loopPrompt).toContain("Use short verification notes.");
  });

  test("prompts omit missing personal user guidance", async () => {
    const { repoRoot } = await makeRepo();
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "forge-prompt-empty-guidance-"));
    tempDirs.push(home);

    const output = await run(repoRoot, ["prompt", "next"], { HOME: home });

    expect(output).not.toContain("Personal user guidance:");
    expect(output).not.toContain("No personal guidance found");
  });
});
