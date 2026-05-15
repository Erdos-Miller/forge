import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveGuidance } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<{ repoRoot: string; nestedDir: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-guidance-test-"));
  tempDirs.push(repoRoot);

  const forgeDir = path.join(repoRoot, ".forge");
  const guidanceDir = path.join(forgeDir, "guidance");
  const tasksDir = path.join(forgeDir, "tasks");
  const nestedDir = path.join(repoRoot, "packages", "core", "src");
  await fs.mkdir(guidanceDir, { recursive: true });
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });

  await fs.writeFile(
    path.join(forgeDir, "guidance.yml"),
    [
      "version: 1",
      "routes:",
      "  - include: guidance/core.md",
      "    when:",
      "      area:",
      "        - core",
      "  - include: guidance/shared.md",
      "    when:",
      "      scope:",
      "        - packages/core/**",
      "  - include: guidance/shared.md",
      "    when:",
      "      path:",
      "        - packages/core/src/**",
      "  - include: guidance/cwd.md",
      "    when:",
      "      cwd:",
      "        - packages/core/**",
      "  - include: guidance/missing.md",
      "    when:",
      "      path:",
      "        - packages/missing/**",
      "",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(guidanceDir, "core.md"),
    ["# Core", "", "## Prompt Summary", "", "Keep core independent.", ""].join("\n"),
  );
  await fs.writeFile(
    path.join(guidanceDir, "shared.md"),
    ["# Shared", "", "## Prompt Summary", "", "Shared package guidance.", ""].join("\n"),
  );
  await fs.writeFile(
    path.join(guidanceDir, "cwd.md"),
    ["# Cwd", "", "## Prompt Summary", "", "Nested cwd guidance.", ""].join("\n"),
  );
  await fs.writeFile(
    path.join(forgeDir, "guidance.local.md"),
    ["# Local", "", "## Prompt Summary", "", "Local user guidance.", ""].join("\n"),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-0001-core.md"),
    taskFile({
      id: "F-0001",
      title: "Core task",
      area: "core",
      scope: ["packages/core/**"],
    }),
  );

  return { repoRoot, nestedDir };
}

function taskFile(options: {
  id: string;
  title: string;
  area: string;
  scope: string[];
}): string {
  return [
    "---",
    `id: ${options.id}`,
    `title: ${options.title}`,
    "kind: task",
    "status: open",
    "priority: medium",
    `area: ${options.area}`,
    'parent: ""',
    "depends_on: []",
    'claimed_by: ""',
    "scope:",
    ...options.scope.map((scope) => `  - ${scope}`),
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    "---",
    "",
    `# ${options.title}`,
    "",
  ].join("\n");
}

describe("resolveGuidance", () => {
  test("resolves guidance by task area and scope with summaries", async () => {
    const { repoRoot } = await makeRepo();
    const bundle = await resolveGuidance({ cwd: repoRoot, taskId: "F-0001" });

    expect(bundle.diagnostics).toEqual([]);
    expect(bundle.matches.map((match) => match.path)).toEqual([
      "guidance/core.md",
      "guidance/shared.md",
      "guidance.local.md",
    ]);
    expect(bundle.matches.map((match) => match.promptSummary)).toEqual([
      "Keep core independent.",
      "Shared package guidance.",
      "Local user guidance.",
    ]);
    expect(bundle.matches[0].reasons).toEqual(["area:core"]);
    expect(bundle.matches[1].reasons).toEqual(["scope:packages/core/**"]);
    expect(bundle.matches[2].reasons).toEqual(["local"]);
  });

  test("resolves guidance by cwd and explicit paths", async () => {
    const { nestedDir } = await makeRepo();
    const bundle = await resolveGuidance({
      cwd: nestedDir,
      paths: ["packages/core/src/index.ts"],
    });

    expect(bundle.matches.map((match) => match.path)).toEqual([
      "guidance/shared.md",
      "guidance/cwd.md",
      "guidance.local.md",
    ]);
    expect(bundle.matches[0].reasons).toEqual(["path:packages/core/src/index.ts"]);
    expect(bundle.matches[1].reasons).toEqual(["cwd:packages/core/src"]);
  });

  test("can include full guidance content", async () => {
    const { repoRoot } = await makeRepo();
    const bundle = await resolveGuidance({
      cwd: repoRoot,
      taskId: "F-0001",
      includeContent: true,
    });

    expect(bundle.matches[0].content).toContain("# Core");
  });

  test("returns diagnostics for missing config and missing include files", async () => {
    const { repoRoot } = await makeRepo();
    await fs.rm(path.join(repoRoot, ".forge", "guidance.yml"));

    expect((await resolveGuidance({ cwd: repoRoot })).diagnostics).toEqual([
      {
        kind: "missing_config",
        message: "no .forge/guidance.yml found",
        path: ".forge/guidance.yml",
      },
    ]);

    await fs.writeFile(
      path.join(repoRoot, ".forge", "guidance.yml"),
      [
        "version: 1",
        "routes:",
        "  - include: guidance/missing.md",
        "    when:",
        "      path:",
        "        - packages/missing/**",
        "",
      ].join("\n"),
    );
    const bundle = await resolveGuidance({
      cwd: repoRoot,
      paths: ["packages/missing/index.ts"],
    });

    expect(bundle.diagnostics).toEqual([
      {
        kind: "missing_include",
        message: "guidance include not found: guidance/missing.md",
        path: "guidance/missing.md",
      },
    ]);
  });
});
