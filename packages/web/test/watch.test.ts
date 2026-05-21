import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";
import {
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";
import {
  createWorkspaceRootCache,
  getWorkspaceRefreshReason,
  isTaskMarkdownFile,
  parseWorkspaceRootsEnv,
  setupForgeWorkspaceWatcher,
  type WatchedTaskDir,
} from "../vite.config";

const workspaceRoot = path.join("/tmp", "forge-workspace");
const apiRoot = path.join(workspaceRoot, "api");
const webRoot = path.join(workspaceRoot, "web");
const watchedDirs: WatchedTaskDir[] = [apiRoot, webRoot].map((repoRoot) => ({
  repoRoot,
  tasksDir: path.join(repoRoot, ".forge", "tasks"),
  realTasksDir: path.join(repoRoot, ".forge", "tasks"),
}));
const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];

afterEach(async () => {
  await Promise.all(fixtureWorkspaces.splice(0).map((workspace) => workspace.cleanup()));
});

function fakeServer() {
  const watchedPaths: string[] = [];
  const watchedEvents: string[] = [];
  const handlers = new Map<string, (filePath: string) => void>();
  const sentEvents: unknown[] = [];
  const server = {
    watcher: {
      add: (filePath: string) => {
        watchedPaths.push(filePath);
      },
      unwatch: () => {},
      on: (eventName: string, handler: (filePath: string) => void) => {
        watchedEvents.push(eventName);
        handlers.set(eventName, handler);
      },
    },
    ws: {
      send: (event: unknown) => {
        sentEvents.push(event);
      },
    },
    config: { logger: { info: () => {}, warn: () => {} } },
  } as any;
  return { handlers, sentEvents, server, watchedEvents, watchedPaths };
}

describe("workspace task watcher helpers", () => {
  test("matches task markdown changes across multiple roots", () => {
    expect(
      getWorkspaceRefreshReason(
        workspaceRoot,
        watchedDirs,
        path.join(apiRoot, ".forge", "tasks", "F-0001.md"),
      ),
    ).toBe("task");
    expect(
      getWorkspaceRefreshReason(
        workspaceRoot,
        watchedDirs,
        path.join(webRoot, ".forge", "tasks", "F-0002.md"),
      ),
    ).toBe("task");
    expect(
      getWorkspaceRefreshReason(
        workspaceRoot,
        watchedDirs,
        path.join(webRoot, ".forge", "tasks", "notes.txt"),
      ),
    ).toBe("roots");
  });

  test("detects root add and remove structure changes below the start directory", () => {
    expect(
      getWorkspaceRefreshReason(
        workspaceRoot,
        watchedDirs,
        path.join(workspaceRoot, "new-root", ".forge"),
      ),
    ).toBe("roots");
    expect(
      getWorkspaceRefreshReason(
        workspaceRoot,
        watchedDirs,
        path.join(workspaceRoot, "new-root", ".forge", "tasks", "F-0003.md"),
      ),
    ).toBe("roots");
    expect(
      getWorkspaceRefreshReason(workspaceRoot, watchedDirs, path.join(workspaceRoot, "README.md")),
    ).toBeNull();
  });

  test("keeps task markdown matching scoped to a tasks directory", () => {
    const tasksDir = path.join(apiRoot, ".forge", "tasks");

    expect(isTaskMarkdownFile(tasksDir, path.join(tasksDir, "F-0001.md"))).toBe(true);
    expect(isTaskMarkdownFile(tasksDir, path.join(tasksDir, "nested", "F-0002.md"))).toBe(true);
    expect(isTaskMarkdownFile(tasksDir, path.join(apiRoot, ".forge", "README.md"))).toBe(false);
    expect(isTaskMarkdownFile(tasksDir, path.join(workspaceRoot, "other.md"))).toBe(false);
  });

  test("returns watcher setup timings for fixture workspaces", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-watch-timing-",
      roots: [
        { name: "api", tasks: minimalForgeFixtureTasks() },
        {
          name: "web",
          tasks: [{ id: "F-1001", title: "Workspace watcher task", priority: "high" }],
        },
      ],
    });
    fixtureWorkspaces.push(workspace);
    const { server, watchedEvents, watchedPaths } = fakeServer();

    const setup = await setupForgeWorkspaceWatcher(server, workspace.workspaceRoot);

    expect(setup.roots.map((root) => root.id)).toEqual(["api", "web"]);
    expect(setup.timings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "watcher.resolve_start_dir",
          durationMs: expect.any(Number),
          rootPath: workspace.workspaceRoot,
        }),
        expect.objectContaining({
          phase: "watcher.discover_roots",
          durationMs: expect.any(Number),
          rootPath: workspace.workspaceRoot,
        }),
        expect.objectContaining({
          phase: "watcher.setup",
          durationMs: expect.any(Number),
        }),
      ]),
    );
    expect(watchedPaths.length).toBeGreaterThanOrEqual(3);
    expect(watchedEvents).toEqual(["add", "change", "unlink", "addDir", "unlinkDir"]);
  });

  test("uses seeded roots for watcher setup without rediscovering", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-watch-cache-",
      roots: [{ name: "api", tasks: minimalForgeFixtureTasks() }],
    });
    fixtureWorkspaces.push(workspace);
    const root = {
      id: "api",
      displayName: "api",
      path: workspace.roots[0].repoRoot,
      taskCount: 1,
    };
    const rootCache = createWorkspaceRootCache([root]);
    const { server } = fakeServer();
    let discoverCalls = 0;

    const setup = await setupForgeWorkspaceWatcher(server, workspace.workspaceRoot, {
      rootCache,
      discoverRoots: async () => {
        discoverCalls += 1;
        return [];
      },
    });

    expect(discoverCalls).toBe(0);
    expect(setup.roots.map((cachedRoot) => cachedRoot.id)).toEqual(["api"]);
    expect(setup.timings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "watcher.discover_roots_cache",
          durationMs: 0,
          rootCount: 1,
        }),
      ]),
    );
  });

  test("invalidates cached roots for Forge structure changes", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-watch-cache-refresh-",
      roots: [
        { name: "api", tasks: minimalForgeFixtureTasks() },
        { name: "web", tasks: minimalForgeFixtureTasks() },
      ],
    });
    fixtureWorkspaces.push(workspace);
    const [apiRoot, webRoot] = workspace.roots.map((root) => ({
      id: path.basename(root.repoRoot),
      displayName: path.basename(root.repoRoot),
      path: root.repoRoot,
      taskCount: 1,
    }));
    const rootCache = createWorkspaceRootCache([apiRoot]);
    const { handlers, sentEvents, server } = fakeServer();
    let discoverCalls = 0;

    const setup = await setupForgeWorkspaceWatcher(server, workspace.workspaceRoot, {
      rootCache,
      discoverRoots: async () => {
        discoverCalls += 1;
        return [apiRoot, webRoot];
      },
    });

    handlers.get("addDir")?.(path.join(setup.workspaceRoot, "web", ".forge"));
    await delay(100);

    expect(discoverCalls).toBe(1);
    expect(rootCache.get()?.map((root) => root.id)).toEqual(["api", "web"]);
    expect(sentEvents).toEqual([
      expect.objectContaining({
        event: "forge:tasks-changed",
        data: expect.objectContaining({ reason: "roots", roots: ["api", "web"] }),
      }),
    ]);
  });

  test("parses seeded workspace roots from the environment", () => {
    const roots = parseWorkspaceRootsEnv(
      JSON.stringify([
        { id: "api", displayName: "api", path: "/repo/api", taskCount: 1 },
        { id: "bad", displayName: "bad", path: "/repo/bad" },
      ]),
    );

    expect(roots).toEqual([
      { id: "api", displayName: "api", path: "/repo/api", taskCount: 1 },
    ]);
    expect(parseWorkspaceRootsEnv("not json")).toEqual([]);
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
