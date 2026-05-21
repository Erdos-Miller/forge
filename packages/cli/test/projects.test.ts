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

describe("project config commands", () => {
  test("reports missing config with inferred project suggestions", async () => {
    const repo = await makeRepo();

    const payload = await runJson(repo.repoRoot, ["projects", "--json"]);

    expect(payload).toMatchObject({
      ok: true,
      version: 1,
      config: { exists: false, projects: [], scopes: [] },
      resolved: {
        source: "inferred",
        projects: expect.arrayContaining([
          expect.objectContaining({
            id: "packages-web",
            label: "packages/web",
            paths: ["packages/web/**"],
          }),
        ]),
      },
    });
    expect(payload.resolved.scopes).toEqual(payload.resolved.projects);
  });

  test("infers candidate projects without writing config", async () => {
    const repo = await makeRepo();

    const payload = await runJson(repo.repoRoot, ["projects", "infer", "--json"]);

    expect(payload.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "packages-web", label: "packages/web" }),
        expect.objectContaining({ id: "lib-typescript-ui", label: "lib/typescript/ui" }),
      ]),
    );
    expect(payload.scopes).toEqual(payload.projects);
    await expect(
      fs.stat(path.join(repo.repoRoot, ".forge", "scopes.yml")),
    ).rejects.toThrow();
  });

  test("adds, updates, and removes project config with readable YAML", async () => {
    const repo = await makeRepo();

    const added = await runJson(repo.repoRoot, [
      "projects",
      "add",
      "web",
      "--label",
      "Web",
      "--path",
      "packages/web/**",
      "--json",
    ]);
    expect(added.config.projects).toEqual([
      { id: "web", label: "Web", paths: ["packages/web/**"] },
    ]);
    expect(added.config.scopes).toEqual(added.config.projects);

    const updated = await runJson(repo.repoRoot, [
      "projects",
      "update",
      "web",
      "--path",
      "packages/web/test/**",
      "--json",
    ]);
    expect(updated.config.projects[0].paths).toEqual([
      "packages/web/**",
      "packages/web/test/**",
    ]);

    const removed = await runJson(repo.repoRoot, [
      "projects",
      "remove",
      "web",
      "--json",
    ]);
    expect(removed.config.projects).toEqual([]);
    expect(await fs.readFile(path.join(repo.repoRoot, ".forge", "scopes.yml"), "utf8"))
      .toContain("projects:\n");
  });

  test("returns project command errors for invalid input", async () => {
    const repo = await makeRepo();

    const invalid = await runJson(repo.repoRoot, [
      "projects",
      "add",
      "Bad_ID",
      "--label",
      "Bad",
      "--path",
      "packages/bad/**",
      "--json",
    ]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr.error.code).toBe("projects_config_error");
    expect(invalid.stderr.error.message).toContain("invalid scope id");

    const missing = await runJson(repo.repoRoot, ["projects", "remove", "missing", "--json"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr.error.code).toBe("projects_config_error");
    expect(missing.stderr.error.message).toContain("scope id not found: missing");

    const usage = await runJson(repo.repoRoot, ["projects", "remove"]);
    expect(usage.code).toBe(2);
    expect(usage.stderr.error.message).toContain("usage: forge projects");
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-projects-cli-",
    tasks: [
      { id: "F-0001", title: "Web", scope: ["packages/web/**"] },
      { id: "F-0002", title: "Component", scope: ["lib/typescript/ui/src/Button.tsx"] },
      { id: "F-0003", title: "Readme", scope: ["README.md"] },
    ],
  });
  fixtureRepos.push(repo);
  return repo;
}

async function runJson(repoRoot: string, args: string[]): Promise<any> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return {
    code,
    ...(stdout[0] ? JSON.parse(stdout[0]) : {}),
    ...(stderr[0] ? { stderr: JSON.parse(stderr[0]) } : {}),
  };
}
