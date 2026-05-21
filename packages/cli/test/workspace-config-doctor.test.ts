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

describe("workspace config doctor diagnostics", () => {
  test("does not warn when workspace config is absent or valid", async () => {
    const missing = await makeRepo();
    expect((await runDoctor(missing.repoRoot)).diagnostics).toEqual([]);

    const valid = await makeRepo();
    await fs.writeFile(
      path.join(valid.repoRoot, "forge.workspace.yml"),
      [
        "version: 1",
        "discovery:",
        "  ignore:",
        '    - "fixtures/generated/**"',
        "",
      ].join("\n"),
    );

    expect((await runDoctor(valid.repoRoot)).diagnostics).toEqual([]);
  });

  test("warns for invalid workspace config ignore paths", async () => {
    const repo = await makeRepo();
    await fs.writeFile(
      path.join(repo.repoRoot, "forge.workspace.yml"),
      [
        "version: 1",
        "discovery:",
        "  ignore:",
        '    - "/Users/ken/local-cache"',
        "",
      ].join("\n"),
    );

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = payload.diagnostics.find((candidate: any) => {
      return candidate.code === "workspace_config_invalid";
    });

    expect(diagnostic).toMatchObject({
      severity: "warning",
      sourcePath: path.join(repo.repoRoot, "forge.workspace.yml"),
    });
    expect(diagnostic.repairHint).toContain("relative paths");
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-workspace-config-doctor-",
    tasks: [{ id: "F-0001", title: "Task" }],
  });
  fixtureRepos.push(repo);
  return repo;
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
