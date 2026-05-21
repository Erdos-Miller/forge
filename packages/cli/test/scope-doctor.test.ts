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

describe("project config doctor diagnostics", () => {
  test("does not warn when a repo has no scope config", async () => {
    const repo = await makeRepo();

    const payload = await runDoctor(repo.repoRoot);

    expect(payload.summary).toEqual({ errors: 0, warnings: 0 });
    expect(payload.diagnostics).toEqual([]);
  });

  test("does not warn for healthy configured Projects", async () => {
    const repo = await makeRepoWithTasks([
      { id: "F-0001", title: "Web", project: "web", scope: ["packages/web/**"] },
      { id: "F-0002", title: "CLI", project: "cli", scope: ["packages/cli/**"] },
      { id: "F-0003", title: "Docs", project: "docs", scope: ["docs/**"] },
    ]);
    await writeProjectConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("cli", "CLI", ["packages/cli/**"]),
      scopeConfigEntry("docs", "Docs", ["docs/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(payload.summary).toEqual({ errors: 0, warnings: 0 });
    expect(payload.diagnostics).toEqual([]);
  });

  test("warns for missing, unknown, and drifted task Project links", async () => {
    const repo = await makeRepoWithTasks([
      { id: "F-0001", title: "Missing", scope: ["packages/web/**"] },
      { id: "F-0002", title: "Unknown", project: "mobile", scope: ["packages/web/**"] },
      { id: "F-0003", title: "Drifted", project: "cli", scope: ["docs/**"] },
      { id: "F-0004", title: "Clean", project: "docs", scope: ["docs/**"] },
    ]);
    await writeProjectConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("cli", "CLI", ["packages/cli/**"]),
      scopeConfigEntry("docs", "Docs", ["docs/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(findDiagnostic(payload, "task_project_missing")).toMatchObject({
      severity: "warning",
      taskId: "F-0001",
      projectId: "web",
    });
    expect(findDiagnostic(payload, "task_project_unknown")).toMatchObject({
      severity: "warning",
      taskId: "F-0002",
      projectId: "mobile",
    });
    expect(findDiagnostic(payload, "task_project_scope_drift")).toMatchObject({
      severity: "warning",
      taskId: "F-0003",
      projectId: "cli",
    });
  });

  test("warns when many active tasks do not match configured scopes", async () => {
    const repo = await makeRepo();
    await writeProjectConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "project_config_unmatched_tasks");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, ".forge", "projects.yml"),
      taskIds: ["F-0002", "F-0003"],
    });
    expect(diagnostic.repairHint).toContain("forge projects infer --json");
  });

  test("warns for overlapping and unused configured Project paths", async () => {
    const repo = await makeRepo();
    await writeProjectConfig(repo.repoRoot, [
      scopeConfigEntry("packages", "Packages", ["packages/**"]),
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("mobile", "Mobile", ["apps/mobile/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const overlap = findDiagnostic(payload, "project_config_overlap");
    const unused = findDiagnostic(payload, "project_config_unused_path");
    const unusedProject = findDiagnostic(payload, "project_config_unused_project");

    expect(overlap).toMatchObject({
      severity: "warning",
      projectIds: ["packages", "web"],
    });
    expect(unused).toMatchObject({
      severity: "warning",
      projectId: "mobile",
      path: "apps/mobile/**",
    });
    expect(unusedProject).toMatchObject({
      severity: "warning",
      projectId: "mobile",
    });
  });

  test("warns for an empty configured Project file", async () => {
    const repo = await makeRepo();
    await fs.writeFile(
      path.join(repo.repoRoot, ".forge", "projects.yml"),
      ["version: 1", "projects:", ""].join("\n"),
    );

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "project_config_empty");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, ".forge", "projects.yml"),
    });
    expect(diagnostic.repairHint).toContain("forge projects infer --json");
  });

  test("warns for legacy scopes config while preserving compatibility", async () => {
    const repo = await makeRepo();
    await writeScopeConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("cli", "CLI", ["packages/cli/**"]),
      scopeConfigEntry("docs", "Docs", ["docs/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "project_config_legacy_scopes_key");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, ".forge", "scopes.yml"),
    });
    expect(diagnostic.repairHint).toContain("forge projects");
  });

  test("warns when preferred and legacy Project config files both exist", async () => {
    const repo = await makeRepo();
    await writeProjectConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("cli", "CLI", ["packages/cli/**"]),
      scopeConfigEntry("docs", "Docs", ["docs/**"]),
    ]);
    await writeScopeConfig(repo.repoRoot, [
      scopeConfigEntry("legacy", "Legacy", ["legacy/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "project_config_preferred_and_legacy");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, ".forge", "projects.yml"),
    });
    expect(diagnostic.repairHint).toContain("Forge reads .forge/projects.yml");
  });

  test("reports malformed project config as doctor errors", async () => {
    const cases = [
      {
        name: "invalid id",
        body: projectConfigEntry("Bad_ID", "Bad", ["packages/bad/**"]),
        message: "invalid scope id",
      },
      {
        name: "empty label",
        body: projectConfigEntry("bad", "", ["packages/bad/**"]),
        message: "scope label must not be empty",
      },
      {
        name: "empty paths",
        body: projectConfigEntry("bad", "Bad", []),
        message: "scope paths must not be empty",
      },
      {
        name: "duplicate paths",
        body: [
          ...projectConfigEntry("web", "Web", ["packages/web/**"]),
          ...projectConfigEntry("web-copy", "Web Copy", ["packages/web/**"]),
        ],
        message: "duplicate scope path",
      },
    ];

    for (const testCase of cases) {
      const repo = await makeRepo();
      await fs.writeFile(
        path.join(repo.repoRoot, ".forge", "projects.yml"),
        ["version: 1", "projects:", ...testCase.body, ""].join("\n"),
      );

      const payload = await runDoctor(repo.repoRoot);
      const diagnostic = findDiagnostic(payload, "project_config_invalid");

      expect(payload.summary.errors).toBe(1);
      expect(diagnostic).toMatchObject({
        severity: "error",
        sourcePath: path.join(repo.repoRoot, ".forge", "projects.yml"),
      });
      expect(diagnostic.message).toContain(testCase.message);
      expect(diagnostic.repairHint).toContain("forge projects infer --json");
    }
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  return makeRepoWithTasks([
    { id: "F-0001", title: "Web", scope: ["packages/web/**"] },
    { id: "F-0002", title: "CLI", scope: ["packages/cli/**"] },
    { id: "F-0003", title: "Docs", scope: ["docs/**"] },
    { id: "F-0004", title: "Done", status: "done", scope: ["legacy/**"] },
  ]);
}

async function makeRepoWithTasks(
  tasks: Parameters<typeof createForgeFixtureRepo>[0]["tasks"],
): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-scope-doctor-",
    tasks,
  });
  fixtureRepos.push(repo);
  return repo;
}

function scopeConfigEntry(id: string, label: string, paths: string[]): string[] {
  return projectConfigEntry(id, label, paths);
}

function projectConfigEntry(id: string, label: string, paths: string[]): string[] {
  return [
    `  - id: ${id}`,
    `    label: "${label}"`,
    "    paths:",
    ...paths.map((scopePath) => `      - "${scopePath}"`),
  ];
}

async function writeScopeConfig(repoRoot: string, entries: string[][]) {
  await writeConfig(repoRoot, "scopes", entries);
}

async function writeProjectConfig(repoRoot: string, entries: string[][]) {
  await writeConfig(repoRoot, "projects", entries, "projects.yml");
}

async function writeConfig(
  repoRoot: string,
  key: "projects" | "scopes",
  entries: string[][],
  filename = "scopes.yml",
) {
  await fs.writeFile(
    path.join(repoRoot, ".forge", filename),
    ["version: 1", `${key}:`, ...entries.flat(), ""].join("\n"),
  );
}

async function runDoctor(repoRoot: string): Promise<any> {
  const stdout: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });
  expect([0, 4]).toContain(code);
  expect(stdout).toHaveLength(1);
  return JSON.parse(stdout[0]);
}

function findDiagnostic(payload: any, code: string) {
  const diagnostic = payload.diagnostics.find((candidate: any) => candidate.code === code);
  expect(diagnostic).toBeDefined();
  return diagnostic;
}
