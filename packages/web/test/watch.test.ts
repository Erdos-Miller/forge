import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  getWorkspaceRefreshReason,
  isTaskMarkdownFile,
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
});
