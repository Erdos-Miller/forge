import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Task, TaskGraphAnalysis } from "@forge/core";
import {
  blockedForgeFixtureTasks,
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";
import {
  getTaskGraphPayload,
  getWorkspaceTaskGraphPayload,
  toTaskGraphPayload,
} from "../src/api";

const tempDirs: string[] = [];
const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];

afterEach(async () => {
  await Promise.all(fixtureWorkspaces.splice(0).map((workspace) => workspace.cleanup()));
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

function taskFile(options: {
  id: string;
  title: string;
  status?: string;
  area?: string;
  depends_on?: string[];
}): string {
  const area = options.area ? [`area: ${options.area}`] : [];
  const dependsOn = options.depends_on?.length
    ? "\n" + options.depends_on.map((id) => `  - ${id}`).join("\n")
    : " []";

  return [
    "---",
    `id: ${options.id}`,
    `title: ${options.title}`,
    "kind: task",
    `status: ${options.status ?? "open"}`,
    "priority: medium",
    ...area,
    'parent: ""',
    `depends_on:${dependsOn}`,
    'claimed_by: ""',
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    "---",
    "",
    `# ${options.title}`,
    "",
  ].join("\n");
}

async function makeRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-web-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const nestedDir = path.join(repoRoot, "apps", "web", "src");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });
  await fs.writeFile(
    path.join(tasksDir, "F-0001-done.md"),
    taskFile({ id: "F-0001", title: "Done", status: "done", area: "core" }),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-0002-ready.md"),
    taskFile({ id: "F-0002", title: "Ready", depends_on: ["F-0001"] }),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-0003-blocked.md"),
    taskFile({ id: "F-0003", title: "Blocked", depends_on: ["F-0002"] }),
  );
  return { repoRoot, nestedDir };
}

async function writeScopeConfig(repoRoot: string, contents: string) {
  await fs.writeFile(path.join(repoRoot, ".forge", "scopes.yml"), contents);
}

describe("getTaskGraphPayload", () => {
  test("returns tasks and graph analysis", async () => {
    const { repoRoot } = await makeRepo();

    const payload = await getTaskGraphPayload(repoRoot);

    expect(payload.tasks.map((task) => task.id)).toEqual([
      "F-0001",
      "F-0002",
      "F-0003",
    ]);
    expect(payload.readyTaskIds).toEqual(["F-0002"]);
    expect(payload.recommendedTaskIds).toEqual(["F-0002"]);
    expect(payload.availabilityByTaskId).toEqual({
      "F-0001": "closed",
      "F-0002": "ready",
      "F-0003": "blocked",
    });
    expect(payload.blockersByTaskId["F-0003"]).toEqual([
      "dependency F-0002 is open",
    ]);
    expect(payload.scopeConfig).toEqual({
      source: "inferred",
      scopes: [{ id: "packages", label: "packages", paths: ["packages/**"] }],
    });
    expect(payload.diagnostics.missingDependencies).toEqual([]);
  });

  test("loads configured scope labels into the task graph payload", async () => {
    const { repoRoot } = await makeRepo();
    await writeScopeConfig(
      repoRoot,
      [
        "version: 1",
        "scopes:",
        "  - id: app",
        '    label: "Application"',
        "    paths:",
        '      - "packages/**"',
        "",
      ].join("\n"),
    );

    const payload = await getTaskGraphPayload(repoRoot);

    expect(payload.scopeConfig).toEqual({
      source: "configured",
      scopes: [{ id: "app", label: "Application", paths: ["packages/**"] }],
    });
  });

  test("works from nested directories via root discovery", async () => {
    const { repoRoot, nestedDir } = await makeRepo();

    const payload = await getTaskGraphPayload(nestedDir);

    expect(payload.repoRoot).toBe(repoRoot);
    expect(payload.readyTaskIds).toEqual(["F-0002"]);
    expect(payload.recommendedTaskIds).toEqual(["F-0002"]);
  });

  test("derives availability when graph analysis has no availability map", () => {
    const tasks = [
      task({ id: "F-0001", title: "Done", status: "done" }),
      task({ id: "F-0002", title: "Ready" }),
      task({ id: "F-0003", title: "Active", status: "doing", claimed_by: "codex" }),
      task({ id: "F-0004", title: "Claimed", claimed_by: "codex" }),
      task({ id: "F-0005", title: "Blocked" }),
    ];
    const analysis = {
      tasksById: new Map(tasks.map((task) => [task.id, task])),
      childrenByParent: new Map(),
      dependentsById: new Map(),
      readyTaskIds: ["F-0002"],
      blockersByTaskId: new Map([["F-0005", ["dependency F-0002 is open"]]]),
      downstreamUnblockCountsByTaskId: new Map(),
      diagnostics: [],
      missingDependencies: [],
      dependencyCycles: [],
      duplicateTaskIds: [],
    } satisfies Omit<TaskGraphAnalysis, "availabilityByTaskId">;

    const payload = toTaskGraphPayload("/repo", tasks, analysis);

    expect(payload.availabilityByTaskId).toEqual({
      "F-0001": "closed",
      "F-0002": "ready",
      "F-0003": "active",
      "F-0004": "claimed",
      "F-0005": "blocked",
    });
  });
});

describe("getWorkspaceTaskGraphPayload", () => {
  test("returns an empty compatible graph when no Forge roots are discovered", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-empty-workspace-",
    });
    fixtureWorkspaces.push(workspace);

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot);

    expect(payload.repoRoot).toBe(workspace.workspaceRoot);
    expect(payload.tasks).toEqual([]);
    expect(payload.readyTaskIds).toEqual([]);
    expect(payload.recommendedTaskIds).toEqual([]);
    expect(payload.workspace).toEqual({
      startDir: workspace.workspaceRoot,
      roots: [],
      diagnostics: {
        loadTimings: expect.arrayContaining([
          expect.objectContaining({
            phase: "workspace.discover_roots",
            durationMs: expect.any(Number),
          }),
          expect.objectContaining({
            phase: "workspace.aggregate_payload",
            durationMs: expect.any(Number),
          }),
        ]),
      },
    });
  });

  test("preserves the single-root task graph while adding workspace metadata", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-single-workspace-",
      roots: [{ name: "app", tasks: blockedForgeFixtureTasks() }],
    });
    fixtureWorkspaces.push(workspace);
    const [root] = workspace.roots;
    const rootPath = await fs.realpath(root.repoRoot);

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot);

    expect(payload.repoRoot).toBe(rootPath);
    expect(payload.tasks.map((task) => task.id)).toEqual(["F-0101", "F-0102"]);
    expect(payload.readyTaskIds).toEqual(["F-0101"]);
    expect(payload.availabilityByTaskId).toEqual({
      "F-0101": "ready",
      "F-0102": "blocked",
    });
    expect(payload.workspace.roots).toEqual([
      expect.objectContaining({
        id: "app",
        displayName: "app",
        path: rootPath,
        status: "ok",
        taskCount: 2,
        graph: expect.objectContaining({
          repoRoot: rootPath,
          readyTaskIds: ["F-0101"],
        }),
        summary: {
          totalTasks: 2,
          readyTaskIds: ["F-0101"],
          recommendedTaskIds: ["F-0101"],
          availabilityCounts: {
            active: 0,
            blocked: 1,
            claimed: 0,
            closed: 0,
            ready: 1,
          },
          diagnostics: {
            missingDependencies: [],
            dependencyCycles: [],
            duplicateTaskIds: [],
          },
        },
      }),
    ]);
    expect(payload.workspace.diagnostics.loadTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "workspace.discover_roots",
          durationMs: expect.any(Number),
          rootPath: workspace.workspaceRoot,
        }),
        expect.objectContaining({
          phase: "root.load_tasks",
          durationMs: expect.any(Number),
          rootId: "app",
          rootPath,
        }),
        expect.objectContaining({
          phase: "root.scope_config",
          durationMs: expect.any(Number),
          rootId: "app",
          rootPath,
        }),
        expect.objectContaining({
          phase: "root.graph_payload",
          durationMs: expect.any(Number),
          rootId: "app",
          rootPath,
          taskCount: 2,
        }),
        expect.objectContaining({
          phase: "workspace.aggregate_payload",
          durationMs: expect.any(Number),
          rootCount: 1,
        }),
      ]),
    );
    expect(payload.workspace.roots[0].timings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "root.load_tasks" }),
        expect.objectContaining({ phase: "root.scope_config" }),
        expect.objectContaining({ phase: "root.graph_payload" }),
      ]),
    );
  });

  test("keeps configured scopes attached to their workspace roots", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-scope-workspace-",
      roots: [
        { name: "api", tasks: minimalForgeFixtureTasks() },
        { name: "web", tasks: blockedForgeFixtureTasks() },
      ],
    });
    fixtureWorkspaces.push(workspace);
    await writeScopeConfig(
      workspace.roots[0].repoRoot,
      [
        "version: 1",
        "scopes:",
        "  - id: server",
        '    label: "Server"',
        "    paths:",
        '      - "packages/**"',
        "",
      ].join("\n"),
    );
    await writeScopeConfig(
      workspace.roots[1].repoRoot,
      [
        "version: 1",
        "scopes:",
        "  - id: client",
        '    label: "Client"',
        "    paths:",
        '      - "packages/**"',
        "",
      ].join("\n"),
    );

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot);

    expect(payload.workspace.roots.map((root) => root.graph?.scopeConfig)).toEqual([
      {
        source: "configured",
        scopes: [{ id: "server", label: "Server", paths: ["packages/**"] }],
      },
      {
        source: "configured",
        scopes: [{ id: "client", label: "Client", paths: ["packages/**"] }],
      },
    ]);
  });

  test("uses cached discovered roots without scanning downward again", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-cached-workspace-",
      roots: [{ name: "app", tasks: minimalForgeFixtureTasks() }],
    });
    fixtureWorkspaces.push(workspace);
    const [root] = workspace.roots;
    const rootPath = await fs.realpath(root.repoRoot);
    let discoverCalls = 0;

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot, {
      roots: [{ id: "app", displayName: "app", path: rootPath, taskCount: 1 }],
      discoverRoots: async () => {
        discoverCalls += 1;
        return [];
      },
    });

    expect(discoverCalls).toBe(0);
    expect(payload.workspace.roots.map((cachedRoot) => cachedRoot.id)).toEqual(["app"]);
    expect(payload.workspace.diagnostics.loadTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "workspace.discover_roots_cache",
          durationMs: 0,
          rootCount: 1,
        }),
      ]),
    );
  });

  test("includes summaries for multiple discovered roots", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-many-workspace-",
      roots: [
        { name: "api", tasks: minimalForgeFixtureTasks() },
        { name: "web", tasks: blockedForgeFixtureTasks() },
      ],
    });
    fixtureWorkspaces.push(workspace);

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot);

    expect(payload.workspace.roots.map((root) => root.id)).toEqual(["api", "web"]);
    expect(payload.workspace.roots.map((root) => root.status)).toEqual(["ok", "ok"]);
    expect(payload.workspace.roots.map((root) => root.summary?.totalTasks)).toEqual([
      1,
      2,
    ]);
    expect(payload.workspace.roots.map((root) => root.summary?.readyTaskIds)).toEqual([
      ["F-0001"],
      ["F-0101"],
    ]);
  });

  test("reports malformed roots without failing valid roots", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-partial-workspace-",
      roots: [
        { name: "broken", malformedFiles: [{ filename: "bad.md", contents: "---\nid: [\n---\n" }] },
        { name: "valid", tasks: minimalForgeFixtureTasks() },
      ],
    });
    fixtureWorkspaces.push(workspace);

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot);
    const brokenRoot = payload.workspace.roots.find((root) => root.id === "broken");
    const validRoot = payload.workspace.roots.find((root) => root.id === "valid");
    const validRootPath = await fs.realpath(workspace.roots[1].repoRoot);

    expect(payload.repoRoot).toBe(validRootPath);
    expect(payload.readyTaskIds).toEqual(["F-0001"]);
    expect(brokenRoot).toMatchObject({
      id: "broken",
      status: "error",
    });
    expect(brokenRoot?.summary).toBeUndefined();
    expect(brokenRoot?.error).toMatch(
      /malformed YAML frontmatter|field "id" must be a string/,
    );
    expect(validRoot).toMatchObject({
      id: "valid",
      status: "ok",
      summary: expect.objectContaining({
        totalTasks: 1,
        readyTaskIds: ["F-0001"],
      }),
    });
  });

  test("keeps malformed-only workspaces as successful empty graphs with root errors", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-broken-workspace-",
      roots: [
        { name: "broken", malformedFiles: [{ filename: "bad.md", contents: "---\nid: [\n---\n" }] },
      ],
    });
    fixtureWorkspaces.push(workspace);

    const payload = await getWorkspaceTaskGraphPayload(workspace.workspaceRoot);

    expect(payload.repoRoot).toBe(workspace.workspaceRoot);
    expect(payload.tasks).toEqual([]);
    expect(payload.workspace.roots).toEqual([
      expect.objectContaining({
        id: "broken",
        status: "error",
        error: expect.stringMatching(
          /malformed YAML frontmatter|field "id" must be a string/,
        ),
      }),
    ]);
  });
});

function task(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    id: overrides.id,
    title: overrides.title,
    kind: "task",
    status: overrides.status ?? "open",
    priority: overrides.priority ?? "medium",
    parent: "",
    depends_on: overrides.depends_on ?? [],
    claimed_by: overrides.claimed_by ?? "",
    scope: ["packages/**"],
    created_at: "2026-05-14T00:00:00-05:00",
    updated_at: "2026-05-14T00:00:00-05:00",
    body: "",
    sourcePath: `/repo/.forge/tasks/${overrides.id}.md`,
  };
}
