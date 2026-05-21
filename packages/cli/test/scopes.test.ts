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

describe("scope config commands", () => {
  test("reports missing config with inferred scopes", async () => {
    const repo = await makeRepo();

    const payload = await runJson(repo.repoRoot, ["scopes", "--json"]);

    expect(payload).toMatchObject({
      ok: true,
      version: 1,
      config: { exists: false, source: "missing", scopes: [] },
      resolved: {
        source: "inferred",
        projects: expect.arrayContaining([
          expect.objectContaining({
            id: "packages-web",
            label: "packages/web",
            paths: ["packages/web/**"],
          }),
        ]),
        scopes: expect.arrayContaining([
          expect.objectContaining({
            id: "packages-web",
            label: "packages/web",
            paths: ["packages/web/**"],
          }),
        ]),
      },
    });
  });

  test("reads existing config and uses it as resolved scopes", async () => {
    const repo = await makeRepo();
    await fs.writeFile(
      path.join(repo.repoRoot, ".forge", "scopes.yml"),
      [
        "version: 1",
        "scopes:",
        "  - id: web",
        "    label: Web",
        "    paths: [\"packages/web/**\"]",
        "",
      ].join("\n"),
    );

    const payload = await runJson(repo.repoRoot, ["scopes", "--json"]);

    expect(payload.config.exists).toBe(true);
    expect(payload.config.source).toBe("legacy");
    expect(payload.config.scopes).toEqual([
      { id: "web", label: "Web", paths: ["packages/web/**"] },
    ]);
    expect(payload.resolved).toEqual({
      source: "configured",
      projects: [{ id: "web", label: "Web", paths: ["packages/web/**"] }],
      scopes: [{ id: "web", label: "Web", paths: ["packages/web/**"] }],
    });
  });

  test("reads preferred projects config and exposes legacy scope aliases", async () => {
    const repo = await makeRepo();
    await fs.writeFile(
      path.join(repo.repoRoot, ".forge", "projects.yml"),
      [
        "version: 1",
        "projects:",
        "  - id: docs",
        "    label: Docs",
        "    paths: [\"docs/**\"]",
        "",
      ].join("\n"),
    );

    const payload = await runJson(repo.repoRoot, ["scopes", "--json"]);

    expect(payload.config.projects).toEqual([
      { id: "docs", label: "Docs", paths: ["docs/**"] },
    ]);
    expect(payload.config.source).toBe("preferred");
    expect(payload.config.sourcePath).toBe(path.join(repo.repoRoot, ".forge", "projects.yml"));
    expect(payload.config.scopes).toEqual(payload.config.projects);
    expect(payload.resolved.projects).toEqual(payload.resolved.scopes);
  });

  test("infers candidate scopes without writing config", async () => {
    const repo = await makeRepo();

    const payload = await runJson(repo.repoRoot, ["scopes", "infer", "--json"]);

    expect(payload.scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "packages-web", label: "packages/web" }),
        expect.objectContaining({ id: "lib-typescript-ui", label: "lib/typescript/ui" }),
      ]),
    );
    await expect(
      fs.stat(path.join(repo.repoRoot, ".forge", "scopes.yml")),
    ).rejects.toThrow();
    await expect(
      fs.stat(path.join(repo.repoRoot, ".forge", "projects.yml")),
    ).rejects.toThrow();
  });

  test("adds and updates scope config with readable YAML", async () => {
    const repo = await makeRepo();

    const added = await runJson(repo.repoRoot, [
      "scopes",
      "add",
      "web",
      "--label",
      "Web",
      "--path",
      "packages/web/**",
      "--json",
    ]);
    expect(added.config.scopes).toEqual([
      { id: "web", label: "Web", paths: ["packages/web/**"] },
    ]);

    const updated = await runJson(repo.repoRoot, [
      "scopes",
      "update",
      "web",
      "--path",
      "packages/web/test/**",
      "--json",
    ]);
    expect(updated.config.scopes[0].paths).toEqual([
      "packages/web/**",
      "packages/web/test/**",
    ]);
    expect(added.config.source).toBe("preferred");
    expect(added.config.sourcePath).toBe(path.join(repo.repoRoot, ".forge", "projects.yml"));
    expect(await fs.readFile(path.join(repo.repoRoot, ".forge", "projects.yml"), "utf8"))
      .toContain('projects:\n  - id: web\n    label: "Web"\n    paths:\n      - "packages/web/**"');
    await expect(
      fs.stat(path.join(repo.repoRoot, ".forge", "scopes.yml")),
    ).rejects.toThrow();
  });

  test("rejects invalid ids and duplicate paths", async () => {
    const repo = await makeRepo();

    const invalid = await runJson(repo.repoRoot, [
      "scopes",
      "add",
      "Bad_ID",
      "--label",
      "Bad",
      "--path",
      "packages/bad/**",
      "--json",
    ]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr.error.message).toContain("invalid scope id");

    await runJson(repo.repoRoot, [
      "scopes",
      "add",
      "web",
      "--label",
      "Web",
      "--path",
      "packages/web/**",
      "--json",
    ]);
    const duplicate = await runJson(repo.repoRoot, [
      "scopes",
      "add",
      "web-tests",
      "--label",
      "Web tests",
      "--path",
      "packages/web/**",
      "--json",
    ]);
    expect(duplicate.code).toBe(1);
    expect(duplicate.stderr.error.message).toContain("duplicate scope path");
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-scopes-cli-",
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
