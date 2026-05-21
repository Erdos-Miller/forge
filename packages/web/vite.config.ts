import react from "@vitejs/plugin-react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { defineConfig, normalizePath, type ViteDevServer } from "vite";
import { discoverForgeRootsDownward } from "../core/src/index.ts";
import { getWorkspaceTaskGraphPayload } from "./src/api";

export default defineConfig({
  plugins: [
    {
      name: "forge-api",
      configureServer(server) {
        const startDir = process.env.FORGE_START_DIR ?? process.cwd();

        setupForgeWorkspaceWatcher(server, startDir).catch((error) => {
          server.config.logger.warn(
            `Forge task watcher disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });

        server.middlewares.use("/api/tasks", async (_request, response) => {
          try {
            const payload = await getWorkspaceTaskGraphPayload(startDir);
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify(payload));
          } catch (error) {
            response.writeHead(500, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        });
      },
    },
    react(),
  ],
});

export interface WatchedTaskDir {
  repoRoot: string;
  tasksDir: string;
  realTasksDir: string;
}

export async function setupForgeWorkspaceWatcher(
  server: ViteDevServer,
  startDir: string,
) {
  const workspaceRoot = await fs.realpath(startDir).catch(() => path.resolve(startDir));
  const watchedTaskDirs = new Map<string, WatchedTaskDir>();
  server.watcher.add(normalizePath(workspaceRoot));

  const syncWatchedRoots = async () => {
    const roots = await discoverForgeRootsDownward(startDir);
    const currentRootPaths = new Set(roots.map((root) => root.path));

    for (const root of roots) {
      if (watchedTaskDirs.has(root.path)) {
        continue;
      }
      const tasksDir = path.join(root.path, ".forge", "tasks");
      const realTasksDir = await fs.realpath(tasksDir).catch(() => tasksDir);
      watchedTaskDirs.set(root.path, { repoRoot: root.path, tasksDir, realTasksDir });
      server.watcher.add(normalizePath(realTasksDir));
    }

    for (const [repoRoot, watched] of watchedTaskDirs) {
      if (!currentRootPaths.has(repoRoot)) {
        server.watcher.unwatch(normalizePath(watched.realTasksDir));
        watchedTaskDirs.delete(repoRoot);
      }
    }

    return roots;
  };

  await syncWatchedRoots();

  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleWorkspaceRefresh = (filePath: string) => {
    const reason = getWorkspaceRefreshReason(
      workspaceRoot,
      Array.from(watchedTaskDirs.values()),
      filePath,
    );
    if (!reason) {
      return;
    }

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(async () => {
      const roots = await syncWatchedRoots();
      server.ws.send({
        type: "custom",
        event: "forge:tasks-changed",
        data: {
          reason,
          startDir,
          roots: roots.map((root) => root.id),
        },
      });
    }, 75);
  };

  server.watcher.on("add", scheduleWorkspaceRefresh);
  server.watcher.on("change", scheduleWorkspaceRefresh);
  server.watcher.on("unlink", scheduleWorkspaceRefresh);
  server.watcher.on("addDir", scheduleWorkspaceRefresh);
  server.watcher.on("unlinkDir", scheduleWorkspaceRefresh);
}

export function getWorkspaceRefreshReason(
  workspaceRoot: string,
  watchedTaskDirs: WatchedTaskDir[],
  filePath: string,
): "task" | "roots" | null {
  if (
    watchedTaskDirs.some(
      (watched) =>
        isTaskMarkdownFile(watched.tasksDir, filePath) ||
        isTaskMarkdownFile(watched.realTasksDir, filePath),
    )
  ) {
    return "task";
  }
  return isForgeStructurePath(workspaceRoot, filePath) ? "roots" : null;
}

export function isTaskMarkdownFile(tasksDir: string, filePath: string) {
  const relativePath = path.relative(tasksDir, path.normalize(filePath));
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath) &&
    filePath.endsWith(".md")
  );
}

function isForgeStructurePath(workspaceRoot: string, filePath: string) {
  const relativePath = path.relative(workspaceRoot, path.normalize(filePath));
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return false;
  }
  return relativePath.split(path.sep).includes(".forge");
}
