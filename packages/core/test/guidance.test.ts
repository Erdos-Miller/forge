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

async function makeMonorepoRepo(): Promise<{
  repoRoot: string;
  toolhubDir: string;
  eclipsetouchDir: string;
}> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-monorepo-guidance-"));
  tempDirs.push(repoRoot);

  const forgeDir = path.join(repoRoot, ".forge");
  const guidanceDir = path.join(forgeDir, "guidance");
  const tasksDir = path.join(forgeDir, "tasks");
  const toolhubDir = path.join(repoRoot, "product", "toolhub", "apps", "web", "src");
  const eclipsetouchDir = path.join(repoRoot, "product", "eclipsetouch", "src");
  await Promise.all(
    [guidanceDir, tasksDir, toolhubDir, eclipsetouchDir].map((dir) =>
      fs.mkdir(dir, { recursive: true }),
    ),
  );

  await fs.writeFile(
    path.join(forgeDir, "guidance.yml"),
    [
      "version: 1",
      "routes:",
      "  - include: guidance/toolhub-widget.md",
      "    when:",
      "      path:",
      "        - product/toolhub/packages/frontend/**",
      "  - include: guidance/toolhub-project.md",
      "    when:",
      "      path:",
      "        - product/toolhub/**",
      "  - include: guidance/shared-frontend.md",
      "    when:",
      "      path:",
      "        - product/toolhub/packages/frontend/**",
      "        - packages/frontend/**",
      "  - include: guidance/toolhub-cwd.md",
      "    when:",
      "      cwd:",
      "        - product/toolhub/**",
      "  - include: guidance/eclipsetouch-cwd.md",
      "    when:",
      "      cwd:",
      "        - product/eclipsetouch/**",
      "  - include: guidance/eclipsetouch-task.md",
      "    when:",
      "      area:",
      "        - eclipsetouch",
      "      scope:",
      "        - product/eclipsetouch/**",
      "  - include: guidance/rust-library.md",
      "    when:",
      "      area:",
      "        - rust",
      "      scope:",
      "        - lib/rust/**",
      "  - include: guidance/shared-frontend-task.md",
      "    when:",
      "      scope:",
      "        - packages/frontend/**",
      "",
    ].join("\n"),
  );

  await writePromptSummary(guidanceDir, "toolhub-widget.md", "Toolhub widget guidance.");
  await writePromptSummary(guidanceDir, "toolhub-project.md", "Toolhub project guidance.");
  await writePromptSummary(guidanceDir, "shared-frontend.md", "Shared frontend guidance.");
  await writePromptSummary(guidanceDir, "toolhub-cwd.md", "Toolhub cwd guidance.");
  await writePromptSummary(guidanceDir, "eclipsetouch-cwd.md", "EclipseTouch cwd guidance.");
  await writePromptSummary(guidanceDir, "eclipsetouch-task.md", "EclipseTouch task guidance.");
  await writePromptSummary(guidanceDir, "rust-library.md", "Rust library guidance.");
  await writePromptSummary(guidanceDir, "shared-frontend-task.md", "Frontend task guidance.");
  await fs.writeFile(
    path.join(tasksDir, "F-1001-rust.md"),
    taskFile({
      id: "F-1001",
      title: "Rust task",
      area: "rust",
      scope: ["lib/rust/fluxchart/**"],
    }),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-1002-frontend.md"),
    taskFile({
      id: "F-1002",
      title: "Frontend task",
      area: "frontend",
      scope: ["packages/frontend/**"],
    }),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-1003-eclipsetouch.md"),
    taskFile({
      id: "F-1003",
      title: "EclipseTouch task",
      area: "eclipsetouch",
      scope: ["product/eclipsetouch/**"],
    }),
  );

  return { repoRoot, toolhubDir, eclipsetouchDir };
}

async function writePromptSummary(
  guidanceDir: string,
  filename: string,
  summary: string,
): Promise<void> {
  await fs.writeFile(
    path.join(guidanceDir, filename),
    [`# ${filename}`, "", "## Prompt Summary", "", summary, ""].join("\n"),
  );
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

  test("resolves monorepo guidance by project, library, cwd, task, and path", async () => {
    const { repoRoot, toolhubDir, eclipsetouchDir } = await makeMonorepoRepo();
    const toolhubBundle = await resolveGuidance({
      cwd: toolhubDir,
      paths: [
        "product/toolhub/packages/frontend/src/Widget.tsx",
        "packages/frontend/src/Button.tsx",
      ],
    });

    expect(toolhubBundle.matches.map((match) => match.path)).toEqual([
      "guidance/toolhub-widget.md",
      "guidance/toolhub-project.md",
      "guidance/shared-frontend.md",
      "guidance/toolhub-cwd.md",
    ]);
    expect(toolhubBundle.matches.map((match) => match.reasons)).toEqual([
      ["path:product/toolhub/packages/frontend/src/Widget.tsx"],
      ["path:product/toolhub/packages/frontend/src/Widget.tsx"],
      ["path:product/toolhub/packages/frontend/src/Widget.tsx"],
      ["cwd:product/toolhub/apps/web/src"],
    ]);

    const eclipsetouchCwdBundle = await resolveGuidance({ cwd: eclipsetouchDir });
    expect(eclipsetouchCwdBundle.matches.map((match) => match.path)).toEqual([
      "guidance/eclipsetouch-cwd.md",
    ]);
    expect(eclipsetouchCwdBundle.matches[0].reasons).toEqual([
      "cwd:product/eclipsetouch/src",
    ]);

    const rustTaskBundle = await resolveGuidance({ cwd: repoRoot, taskId: "F-1001" });
    expect(rustTaskBundle.matches.map((match) => match.path)).toEqual([
      "guidance/rust-library.md",
    ]);
    expect(rustTaskBundle.matches[0].reasons).toEqual([
      "area:rust",
      "scope:lib/rust/fluxchart/**",
    ]);

    const frontendTaskBundle = await resolveGuidance({ cwd: repoRoot, taskId: "F-1002" });
    expect(frontendTaskBundle.matches.map((match) => match.path)).toEqual([
      "guidance/shared-frontend-task.md",
    ]);
    expect(frontendTaskBundle.matches[0].reasons).toEqual([
      "scope:packages/frontend/**",
    ]);

    const eclipsetouchTaskBundle = await resolveGuidance({
      cwd: repoRoot,
      taskId: "F-1003",
    });
    expect(eclipsetouchTaskBundle.matches.map((match) => match.path)).toEqual([
      "guidance/eclipsetouch-task.md",
    ]);
    expect(eclipsetouchTaskBundle.matches[0].reasons).toEqual([
      "area:eclipsetouch",
      "scope:product/eclipsetouch/**",
    ]);
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
