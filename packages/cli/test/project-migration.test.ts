import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createForgeFixtureRepo,
  type ForgeFixtureRepo,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

describe("project migration dry-run", () => {
  test("reports legacy config migration and task project backfills without writing", async () => {
    const repo = await createRepo([
      { id: "F-0001", title: "CLI task", scope: ["packages/cli/src/**"] },
      { id: "F-0002", title: "Web task", scope: ["packages/web/src/**"] },
      { id: "F-0003", title: "Root task", scope: ["README.md"] },
      {
        id: "F-0004",
        title: "Unknown project task",
        project: "missing",
        scope: ["packages/cli/test/**"],
      },
      { id: "F-0005", title: "Closed task", status: "done", scope: ["docs/**"] },
    ]);
    const legacyPath = path.join(repo.repoRoot, ".forge", "scopes.yml");
    await writeProjectConfig(legacyPath, "scopes", [
      projectConfigEntry("cli", "CLI", ["packages/cli/**"]),
      projectConfigEntry("web", "Web", ["packages/web/**"]),
      projectConfigEntry("docs", "Docs", ["docs/**"]),
    ]);
    const before = await fs.readFile(legacyPath, "utf8");

    const payload = await runJson(repo.repoRoot, ["projects", "migrate", "--dry-run", "--json"]);

    expect(payload.config.source).toBe("legacy");
    expect(payload.migration.steps).toEqual([
      {
        action: "copy_legacy_config",
        from: legacyPath,
        to: path.join(repo.repoRoot, ".forge", "projects.yml"),
      },
    ]);
    expect(payload.backfill.unambiguous.map((task: any) => [task.taskId, task.project])).toEqual([
      ["F-0001", "cli"],
      ["F-0002", "web"],
    ]);
    expect(payload.backfill.noMatch.map((task: any) => task.taskId)).toEqual(["F-0003"]);
    expect(payload.unknownTaskProjects.map((task: any) => task.taskId)).toEqual(["F-0004"]);
    expect(payload.staleProjectPaths).toEqual([{ project: "docs", path: "docs/**" }]);
    expect(await fs.readFile(legacyPath, "utf8")).toBe(before);
    await expect(fs.stat(path.join(repo.repoRoot, ".forge", "projects.yml"))).rejects.toThrow();
  });

  test("reports preferred config ambiguity and already-set task projects", async () => {
    const repo = await createRepo([
      { id: "F-0001", title: "Ambiguous task", scope: ["packages/cli/src/**"] },
      { id: "F-0002", title: "Docs task", project: "docs", scope: ["docs/**"] },
    ]);
    await writeProjectConfig(path.join(repo.repoRoot, ".forge", "projects.yml"), "projects", [
      projectConfigEntry("packages", "Packages", ["packages/**"]),
      projectConfigEntry("cli", "CLI", ["packages/cli/**"]),
      projectConfigEntry("docs", "Docs", ["docs/**"]),
    ]);

    const payload = await runJson(repo.repoRoot, ["projects", "migrate", "--dry-run", "--json"]);

    expect(payload.config.source).toBe("preferred");
    expect(payload.migration.steps).toEqual([]);
    expect(payload.backfill.ambiguous).toEqual([
      expect.objectContaining({
        taskId: "F-0001",
        projects: ["packages", "cli"],
      }),
    ]);
    expect(payload.backfill.alreadySet).toEqual([
      expect.objectContaining({ taskId: "F-0002", project: "docs" }),
    ]);
  });

  test("rejects migration dry-run without the explicit dry-run JSON form", async () => {
    const repo = await createRepo([]);
    const result = await run(repo.repoRoot, ["projects", "migrate", "--json"]);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr[0]).error.message).toContain("usage: forge projects");
  });
});

async function createRepo(tasks: Parameters<typeof createForgeFixtureRepo>[0]["tasks"]) {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-project-migration-",
    tasks,
  });
  fixtureRepos.push(repo);
  return repo;
}

async function runJson(repoRoot: string, args: string[]): Promise<any> {
  const result = await run(repoRoot, args);
  expect(result.code).toBe(0);
  return JSON.parse(result.stdout[0]);
}

async function run(cwd: string, args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { code, stdout, stderr };
}

async function writeProjectConfig(
  filePath: string,
  key: "projects" | "scopes",
  entries: string[][],
): Promise<void> {
  await fs.writeFile(filePath, ["version: 1", `${key}:`, ...entries.flat(), ""].join("\n"));
}

function projectConfigEntry(id: string, label: string, paths: string[]): string[] {
  return [
    `  - id: ${id}`,
    `    label: "${label}"`,
    "    paths:",
    ...paths.map((projectPath) => `      - "${projectPath}"`),
  ];
}
