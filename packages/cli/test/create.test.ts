import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseTaskFile } from "@forge/core";
import {
  createForgeFixtureRepo,
  type ForgeFixtureRepo,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

describe("create command", () => {
  test("keeps the explicit-id task creation form", async () => {
    const repo = await makeRepo();
    const result = await run(repo.nestedDir, [
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
      "--project",
      "cli",
      "--priority",
      "high",
      "--scope",
      "packages/cli/**",
      "--depends-on",
      "F-0002",
      "--acceptance",
      "The generated file has canonical Markdown sections.",
      "--acceptance",
      "The generated file keeps rich text in Markdown.",
      "--verification",
      "bun test packages/cli",
      "--verification",
      "bun run harness:cli",
      "--notes",
      "Keep the generated task readable.",
    ]);

    const parsed = await readTask(repo.repoRoot, "F-0004-add-task-creation.md");

    expect(result.code).toBe(0);
    expect(result.stdout[0]).toContain("created F-0004");
    expect(parsed.task.title).toBe("Add task creation");
    expect(parsed.task.priority).toBe("high");
    expect(parsed.task.project).toBe("cli");
    expect(parsed.task.area).toBe("cli");
    expect(parsed.task.scope).toEqual(["packages/cli/**"]);
    expect(parsed.task.depends_on).toEqual(["F-0002"]);
    expect(parsed.task.body).toContain("## Why");
    expect(parsed.task.body).toContain("## What success looks like");
    expect(parsed.task.body).toContain("## Acceptance Criteria");
    expect(parsed.task.body).toContain("- The generated file has canonical Markdown sections.");
    expect(parsed.task.body).toContain("- The generated file keeps rich text in Markdown.");
    expect(parsed.task.body).toContain("## Dependencies");
    expect(parsed.task.body).toContain("## Verification");
    expect(parsed.task.body).toContain("- bun test packages/cli");
    expect(parsed.task.body).toContain("- bun run harness:cli");
    expect(parsed.task.body).toContain("## Notes");
    expect(parsed.task.body).toContain("Keep the generated task readable.");
    expect(parsed.task.body).toContain("## History");
  });

  test("supports title-first project creation with JSON output", async () => {
    const repo = await makeRepo();
    await writeProjectConfig(repo.repoRoot, [
      projectConfigEntry("cli", "CLI", ["packages/cli/**"]),
    ]);

    const result = await run(repo.nestedDir, [
      "create",
      "Add project-first task",
      "--project",
      "cli",
      "--area",
      "cli",
      "--json",
    ]);
    const payload = JSON.parse(result.stdout[0]);
    const parsed = await readTask(repo.repoRoot, "F-0004-add-project-first-task.md");

    expect(result.code).toBe(0);
    expect(payload.project).toEqual({ value: "cli", source: "explicit" });
    expect(payload.task.id).toBe("F-0004");
    expect(payload.task.project).toBe("cli");
    expect(parsed.task.project).toBe("cli");
    expect(parsed.task.area).toBe("cli");
    expect(parsed.task.scope).toEqual(["**"]);
  });

  test("infers project from cwd when exactly one configured Project matches", async () => {
    const repo = await makeRepo();
    await writeProjectConfig(repo.repoRoot, [
      projectConfigEntry("cli", "CLI", ["packages/cli/**"]),
      projectConfigEntry("docs", "Docs", ["docs/**"]),
    ]);

    const result = await run(repo.nestedDir, ["create", "Infer project from cwd", "--json"]);
    const payload = JSON.parse(result.stdout[0]);

    expect(result.code).toBe(0);
    expect(payload.project).toEqual({ value: "cli", source: "inferred" });
    expect(payload.task.project).toBe("cli");
  });

  test("leaves project unset when cwd matches no Project", async () => {
    const repo = await makeRepo();
    const otherDir = path.join(repo.repoRoot, "sandbox");
    await fs.mkdir(otherDir);
    await writeProjectConfig(repo.repoRoot, [
      projectConfigEntry("cli", "CLI", ["packages/cli/**"]),
    ]);

    const result = await run(otherDir, ["create", "No matching project", "--json"]);
    const payload = JSON.parse(result.stdout[0]);

    expect(result.code).toBe(0);
    expect(payload.project).toEqual({ value: null, source: "unset" });
    expect(payload.task.project).toBeNull();
  });

  test("rejects ambiguous and invalid Project selection", async () => {
    const repo = await makeRepo();
    await writeProjectConfig(repo.repoRoot, [
      projectConfigEntry("packages", "Packages", ["packages/**"]),
      projectConfigEntry("cli", "CLI", ["packages/cli/**"]),
    ]);

    const ambiguous = await run(repo.nestedDir, ["create", "Ambiguous project"]);
    const unknown = await run(repo.nestedDir, [
      "create",
      "Unknown project",
      "--project",
      "web",
    ]);
    const invalid = await run(repo.nestedDir, [
      "create",
      "Invalid project",
      "--project",
      "Bad_ID",
    ]);

    expect(ambiguous.code).toBe(1);
    expect(ambiguous.stderr[0]).toContain("cwd matches multiple Projects: packages, cli");
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toEqual(["unknown project web"]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr[0]).toContain("project must match");
  });

  test("requires a title for the explicit-id form", async () => {
    const repo = await makeRepo();
    const result = await run(repo.repoRoot, ["create", "F-0004"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(["create requires --title <title>"]);
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-create-cli-",
    nestedPath: ["packages", "cli", "src"],
    tasks: [
      { id: "F-0001", title: "Done", status: "done" },
      { id: "F-0002", title: "Open", status: "open" },
      { id: "F-0003", title: "Blocked", status: "blocked", depends_on: ["F-0002"] },
    ],
  });
  fixtureRepos.push(repo);
  return repo;
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
    now: new Date("2026-05-14T12:00:00.000Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { code, stdout, stderr };
}

async function readTask(repoRoot: string, filename: string) {
  const taskPath = path.join(repoRoot, ".forge", "tasks", filename);
  return parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));
}

async function writeProjectConfig(repoRoot: string, entries: string[][]): Promise<void> {
  await fs.writeFile(
    path.join(repoRoot, ".forge", "projects.yml"),
    ["version: 1", "projects:", ...entries.flat(), ""].join("\n"),
  );
}

function projectConfigEntry(id: string, label: string, paths: string[]): string[] {
  return [
    `  - id: ${id}`,
    `    label: "${label}"`,
    "    paths:",
    ...paths.map((projectPath) => `      - "${projectPath}"`),
  ];
}
