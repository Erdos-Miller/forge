import react from "@vitejs/plugin-react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { defineConfig, normalizePath, type ViteDevServer } from "vite";
import { discoverForgeRootsDownward, type DiscoveredForgeRoot } from "../core/src/index.ts";
import {
  getWorkspaceTaskGraphPayload,
  type WorkspaceLoadTiming,
  type WorkspaceRootPayload,
  type WorkspaceRootPayloadCache,
} from "./src/api";

export default defineConfig({
  plugins: [
    {
      name: "forge-api",
      configureServer(server) {
        const startDir = process.env.FORGE_START_DIR ?? process.cwd();
        const rootCache = createWorkspaceRootCache(
          parseWorkspaceRootsEnv(process.env.FORGE_WORKSPACE_ROOTS),
        );
        const rootPayloadCache = createWorkspaceRootPayloadCache();

        setupForgeWorkspaceWatcher(server, startDir, { rootCache, rootPayloadCache })
          .then((setup) => {
            const total = setup.timings.find((timing) => timing.phase === "watcher.setup");
            const duration = total ? `${total.durationMs}ms` : "unknown duration";
            server.config.logger.info(
              `Forge task watcher setup completed in ${duration} for ${setup.roots.length} root(s)`,
            );
          })
          .catch((error) => {
            server.config.logger.warn(
              `Forge task watcher disabled: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });

        server.middlewares.use("/api/tasks", async (_request, response) => {
          try {
            const payload = await getWorkspaceTaskGraphPayload(startDir, {
              roots: rootCache.get() ?? undefined,
              rootPayloadCache,
            });
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
  rootId: string;
  repoRoot: string;
  tasksDir: string;
  realTasksDir: string;
}

export interface ForgeWorkspaceWatcherSetup {
  workspaceRoot: string;
  roots: DiscoveredForgeRoot[];
  timings: WorkspaceLoadTiming[];
}

export interface WorkspaceRootCache {
  get(): DiscoveredForgeRoot[] | null;
  set(roots: DiscoveredForgeRoot[]): void;
  clear(): void;
}

export interface WorkspaceRefreshPlan {
  reason: "task" | "roots";
  rootId?: string;
  rootPath?: string;
}

export interface ForgeWorkspaceWatcherOptions {
  rootCache?: WorkspaceRootCache;
  rootPayloadCache?: WorkspaceRootPayloadCache;
  discoverRoots?: (startDir: string) => Promise<DiscoveredForgeRoot[]>;
}

export function createWorkspaceRootCache(
  initialRoots: DiscoveredForgeRoot[] = [],
): WorkspaceRootCache {
  let cachedRoots = initialRoots.length > 0 ? initialRoots : null;
  return {
    get: () => cachedRoots,
    set: (roots) => {
      cachedRoots = roots;
    },
    clear: () => {
      cachedRoots = null;
    },
  };
}

export function createWorkspaceRootPayloadCache(): WorkspaceRootPayloadCache {
  const payloads = new Map<string, WorkspaceRootPayload>();
  return {
    get: (rootPath) => payloads.get(rootPath),
    set: (rootPath, payload) => {
      payloads.set(rootPath, payload);
    },
    delete: (rootPath) => {
      payloads.delete(rootPath);
    },
    clear: () => {
      payloads.clear();
    },
  };
}

export async function setupForgeWorkspaceWatcher(
  server: ViteDevServer,
  startDir: string,
  options: ForgeWorkspaceWatcherOptions = {},
): Promise<ForgeWorkspaceWatcherSetup> {
  const timings: WorkspaceLoadTiming[] = [];
  const rootCache = options.rootCache ?? createWorkspaceRootCache();
  const discoverRoots = options.discoverRoots ?? discoverForgeRootsDownward;
  return measureWatcherSetupPhase(timings, "watcher.setup", async () => {
    const workspaceRoot = await measureWatcherSetupPhase(
      timings,
      "watcher.resolve_start_dir",
      () => fs.realpath(startDir).catch(() => path.resolve(startDir)),
      { rootPath: startDir },
    );
    const watchedTaskDirs = new Map<string, WatchedTaskDir>();
    server.watcher.add(normalizePath(workspaceRoot));

    const syncWatchedRoots = async (forceDiscover = false) => {
      if (forceDiscover) {
        rootCache.clear();
      }

      const cachedRoots = rootCache.get();
      const roots = cachedRoots
        ? measureCachedWatcherRoots(timings, startDir, cachedRoots)
        : await measureWatcherSetupPhase(
            timings,
            "watcher.discover_roots",
            () => discoverRoots(startDir),
            { rootPath: startDir },
          );
      if (!cachedRoots) {
        rootCache.set(roots);
      }
      const currentRootPaths = new Set(roots.map((root) => root.path));

      for (const root of roots) {
        if (watchedTaskDirs.has(root.path)) {
          continue;
        }
        const tasksDir = path.join(root.path, ".forge", "tasks");
        const realTasksDir = await fs.realpath(tasksDir).catch(() => tasksDir);
        watchedTaskDirs.set(root.path, {
          rootId: root.id,
          repoRoot: root.path,
          tasksDir,
          realTasksDir,
        });
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

    const setupRoots = await syncWatchedRoots();

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingRefreshPlan: WorkspaceRefreshPlan | undefined;
    const scheduleWorkspaceRefresh = (filePath: string) => {
      const refreshPlan = getWorkspaceRefreshPlan(
        workspaceRoot,
        Array.from(watchedTaskDirs.values()),
        filePath,
      );
      if (!refreshPlan) {
        return;
      }

      pendingRefreshPlan = mergeWorkspaceRefreshPlans(pendingRefreshPlan, refreshPlan);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(async () => {
        const plan = pendingRefreshPlan ?? { reason: "roots" };
        pendingRefreshPlan = undefined;
        if (plan.reason === "roots") {
          options.rootPayloadCache?.clear();
        } else if (plan.rootPath) {
          options.rootPayloadCache?.delete(plan.rootPath);
        }
        const roots = await syncWatchedRoots(plan.reason === "roots");
        server.ws.send({
          type: "custom",
          event: "forge:tasks-changed",
          data: {
            reason: plan.reason,
            startDir,
            rootId: plan.rootId,
            rootPath: plan.rootPath,
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

    return { workspaceRoot, roots: setupRoots, timings };
  });
}

export function parseWorkspaceRootsEnv(value: string | undefined): DiscoveredForgeRoot[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isDiscoveredForgeRoot);
  } catch {
    return [];
  }
}

export function getWorkspaceRefreshReason(
  workspaceRoot: string,
  watchedTaskDirs: WatchedTaskDir[],
  filePath: string,
): "task" | "roots" | null {
  return getWorkspaceRefreshPlan(workspaceRoot, watchedTaskDirs, filePath)?.reason ?? null;
}

export function getWorkspaceRefreshPlan(
  workspaceRoot: string,
  watchedTaskDirs: WatchedTaskDir[],
  filePath: string,
): WorkspaceRefreshPlan | null {
  const owningRoots = watchedTaskDirs.filter(
    (watched) =>
      isTaskMarkdownFile(watched.tasksDir, filePath) ||
      isTaskMarkdownFile(watched.realTasksDir, filePath),
  );
  if (owningRoots.length === 1) {
    return {
      reason: "task",
      rootId: owningRoots[0].rootId,
      rootPath: owningRoots[0].repoRoot,
    };
  }
  if (owningRoots.length > 1) {
    return { reason: "roots" };
  }
  return isForgeStructurePath(workspaceRoot, filePath) ? { reason: "roots" } : null;
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

function isDiscoveredForgeRoot(value: unknown): value is DiscoveredForgeRoot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<DiscoveredForgeRoot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.taskCount === "number"
  );
}

function mergeWorkspaceRefreshPlans(
  previous: WorkspaceRefreshPlan | undefined,
  next: WorkspaceRefreshPlan,
): WorkspaceRefreshPlan {
  if (!previous) {
    return next;
  }
  if (previous.reason === "roots" || next.reason === "roots") {
    return { reason: "roots" };
  }
  if (previous.rootPath !== next.rootPath) {
    return { reason: "roots" };
  }
  return previous;
}

function measureCachedWatcherRoots(
  timings: WorkspaceLoadTiming[],
  startDir: string,
  roots: DiscoveredForgeRoot[],
): DiscoveredForgeRoot[] {
  timings.push({
    phase: "watcher.discover_roots_cache",
    durationMs: 0,
    rootPath: startDir,
    rootCount: roots.length,
  });
  return roots;
}

async function measureWatcherSetupPhase<T>(
  timings: WorkspaceLoadTiming[],
  phase: string,
  run: () => T | Promise<T>,
  context: Omit<WorkspaceLoadTiming, "phase" | "durationMs"> = {},
): Promise<T> {
  const start = performance.now();
  try {
    return await run();
  } finally {
    timings.push({
      phase,
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      ...context,
    });
  }
}
