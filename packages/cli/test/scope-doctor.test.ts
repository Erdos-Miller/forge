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

describe("scope config doctor diagnostics", () => {
  test("does not warn when a repo has no scope config", async () => {
    const repo = await makeRepo();

    const payload = await runDoctor(repo.repoRoot);

    expect(payload.summary).toEqual({ errors: 0, warnings: 0 });
    expect(payload.diagnostics).toEqual([]);
  });

  test("does not warn for healthy configured scopes", async () => {
    const repo = await makeRepo();
    await writeScopeConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("cli", "CLI", ["packages/cli/**"]),
      scopeConfigEntry("docs", "Docs", ["docs/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(payload.summary).toEqual({ errors: 0, warnings: 0 });
    expect(payload.diagnostics).toEqual([]);
  });

  test("warns when many active tasks do not match configured scopes", async () => {
    const repo = await makeRepo();
    await writeScopeConfig(repo.repoRoot, [
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "scope_config_unmatched_tasks");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, ".forge", "scopes.yml"),
      taskIds: ["F-0002", "F-0003"],
    });
    expect(diagnostic.repairHint).toContain("forge scopes infer --json");
  });

  test("warns for overlapping and unused configured scope paths", async () => {
    const repo = await makeRepo();
    await writeScopeConfig(repo.repoRoot, [
      scopeConfigEntry("packages", "Packages", ["packages/**"]),
      scopeConfigEntry("web", "Web", ["packages/web/**"]),
      scopeConfigEntry("mobile", "Mobile", ["apps/mobile/**"]),
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const overlap = findDiagnostic(payload, "scope_config_overlap");
    const unused = findDiagnostic(payload, "scope_config_unused_path");

    expect(overlap).toMatchObject({
      severity: "warning",
      scopeIds: ["packages", "web"],
    });
    expect(unused).toMatchObject({
      severity: "warning",
      scopeId: "mobile",
      path: "apps/mobile/**",
    });
  });

  test("warns for an empty configured scope file", async () => {
    const repo = await makeRepo();
    await fs.writeFile(
      path.join(repo.repoRoot, ".forge", "scopes.yml"),
      ["version: 1", "scopes:", ""].join("\n"),
    );

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "scope_config_empty");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, ".forge", "scopes.yml"),
    });
    expect(diagnostic.repairHint).toContain("forge scopes infer --json");
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-scope-doctor-",
    tasks: [
      { id: "F-0001", title: "Web", scope: ["packages/web/**"] },
      { id: "F-0002", title: "CLI", scope: ["packages/cli/**"] },
      { id: "F-0003", title: "Docs", scope: ["docs/**"] },
      { id: "F-0004", title: "Done", status: "done", scope: ["legacy/**"] },
    ],
  });
  fixtureRepos.push(repo);
  return repo;
}

function scopeConfigEntry(id: string, label: string, paths: string[]): string[] {
  return [
    `  - id: ${id}`,
    `    label: "${label}"`,
    "    paths:",
    ...paths.map((scopePath) => `      - "${scopePath}"`),
  ];
}

async function writeScopeConfig(repoRoot: string, entries: string[][]) {
  await fs.writeFile(
    path.join(repoRoot, ".forge", "scopes.yml"),
    ["version: 1", "scopes:", ...entries.flat(), ""].join("\n"),
  );
}

async function runDoctor(repoRoot: string): Promise<any> {
  const stdout: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  return JSON.parse(stdout[0]);
}

function findDiagnostic(payload: any, code: string) {
  const diagnostic = payload.diagnostics.find((candidate: any) => candidate.code === code);
  expect(diagnostic).toBeDefined();
  return diagnostic;
}
