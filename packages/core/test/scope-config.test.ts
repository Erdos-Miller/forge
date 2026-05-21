import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addScopeConfigEntry,
  getProjectConfigPath,
  getScopeConfigPath,
  parseScopeConfig,
  readScopeConfig,
} from "../src/scope-config";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

describe("project config compatibility", () => {
  test("parses preferred projects config with legacy scopes alias", () => {
    const config = parseScopeConfig(
      [
        "version: 1",
        "projects:",
        "  - id: web",
        '    label: "Web"',
        '    description: "Browser UI"',
        "    paths:",
        '      - "packages/web/**"',
        "",
      ].join("\n"),
    );

    expect(config.projects).toEqual([
      {
        id: "web",
        label: "Web",
        description: "Browser UI",
        paths: ["packages/web/**"],
      },
    ]);
    expect(config.scopes).toBe(config.projects);
  });

  test("parses legacy scopes config as projects", () => {
    const config = parseScopeConfig(
      [
        "version: 1",
        "scopes:",
        "  - id: cli",
        '    label: "CLI"',
        "    paths:",
        '      - "packages/cli/**"',
        "",
      ].join("\n"),
    );

    expect(config.projects).toEqual([
      { id: "cli", label: "CLI", paths: ["packages/cli/**"] },
    ]);
    expect(config.scopes).toBe(config.projects);
  });

  test("reads preferred projects file before legacy scopes file", async () => {
    const repoRoot = await makeRepo();
    await writeConfig(getScopeConfigPath(repoRoot), "legacy");
    await writeConfig(getProjectConfigPath(repoRoot), "preferred");

    const result = await readScopeConfig(repoRoot);

    expect(result.source).toBe("preferred");
    expect(result.sourcePath).toBe(getProjectConfigPath(repoRoot));
    expect(result.legacySourcePath).toBe(getScopeConfigPath(repoRoot));
    expect(result.config.projects[0].id).toBe("preferred");
  });

  test("reads legacy scopes file when preferred projects file is missing", async () => {
    const repoRoot = await makeRepo();
    await writeConfig(getScopeConfigPath(repoRoot), "legacy");

    const result = await readScopeConfig(repoRoot);

    expect(result.source).toBe("legacy");
    expect(result.sourcePath).toBe(getScopeConfigPath(repoRoot));
    expect(result.config.projects[0].id).toBe("legacy");
  });

  test("writes new project config to projects.yml", async () => {
    const repoRoot = await makeRepo();

    const result = await addScopeConfigEntry(repoRoot, {
      id: "web",
      label: "Web",
      paths: ["packages/web/**"],
    });

    expect(result.source).toBe("preferred");
    expect(result.sourcePath).toBe(getProjectConfigPath(repoRoot));
    await expect(fs.stat(getProjectConfigPath(repoRoot))).resolves.toBeTruthy();
    await expect(fs.stat(getScopeConfigPath(repoRoot))).rejects.toThrow();
  });
});

async function makeRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-project-config-"));
  tempDirs.push(repoRoot);
  await fs.mkdir(path.join(repoRoot, ".forge"), { recursive: true });
  return repoRoot;
}

async function writeConfig(filePath: string, id: string): Promise<void> {
  await fs.writeFile(
    filePath,
    [
      "version: 1",
      "projects:",
      `  - id: ${id}`,
      `    label: "${id}"`,
      "    paths:",
      `      - "packages/${id}/**"`,
      "",
    ].join("\n"),
  );
}
