import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";
import {
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";
import {
  getWorkspaceRefreshReason,
  isTaskMarkdownFile,
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
    const watchedPaths: string[] = [];
    const watchedEvents: string[] = [];
    const server = {
      watcher: {
        add: (filePath: string) => {
          watchedPaths.push(filePath);
        },
        unwatch: () => {},
        on: (eventName: string) => {
          watchedEvents.push(eventName);
        },
      },
      ws: { send: () => {} },
      config: { logger: { info: () => {}, warn: () => {} } },
    } as any;

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
});
