import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  analyzeTasks,
  discoverForgeRootsDownward,
  findForgeRoot,
  loadTasks,
  rankReadyTasks,
  readScopeConfig,
  type DiscoveredForgeRoot,
  type ScopeConfigEntry,
  type Task,
  type TaskGraphAnalysis,
  type TaskAvailability,
} from "../../core/src/index.ts";
import {
  classifyWorktreeEntries,
  recommendWorktreeStatus,
  type GitStatusEntry,
  type WorktreeRecommendation,
  type WorktreeStatusFile,
} from "../../core/src/worktree-coordination.ts";
import { inferScopeLabel, OTHER_SCOPE } from "./scopes";

const execFileAsync = promisify(execFile);

export interface ScopeFilterPayload extends ScopeConfigEntry {
  rootId?: string;
}

export interface ResolvedScopeConfigPayload {
  source: "configured" | "inferred";
  scopes: ScopeFilterPayload[];
}

export interface TaskGraphPayload {
  repoRoot: string;
  tasks: Task[];
  readyTaskIds: string[];
  recommendedTaskIds: string[];
  availabilityByTaskId: Record<string, TaskAvailability>;
  blockersByTaskId: Record<string, string[]>;
  coordinationByTaskId: Record<string, TaskCoordinationPayload>;
  scopeConfig: ResolvedScopeConfigPayload;
  diagnostics: {
    missingDependencies: Array<{ taskId: string; dependencyId: string }>;
    dependencyCycles: Array<{ taskIds: string[] }>;
    duplicateTaskIds: Array<{ taskId: string; sourcePaths: string[] }>;
  };
}

export interface TaskCoordinationPayload {
  summary: {
    blocking: number;
    review: number;
    non_blocking: number;
    total: number;
    clean: boolean;
  };
  files: WorktreeStatusFile[];
  recommendation: WorktreeRecommendation;
}

export interface WorkspaceLoadTiming {
  phase: string;
  durationMs: number;
  rootId?: string;
  rootPath?: string;
  rootCount?: number;
  taskCount?: number;
}

export interface WorkspaceRootPayload extends DiscoveredForgeRoot {
  status: "ok" | "error";
  graph?: TaskGraphPayload;
  timings?: WorkspaceLoadTiming[];
  summary?: {
    totalTasks: number;
    readyTaskIds: string[];
    recommendedTaskIds: string[];
    availabilityCounts: Record<TaskAvailability, number>;
    diagnostics: TaskGraphPayload["diagnostics"];
  };
  error?: string;
}

export interface WorkspaceTaskGraphPayload extends TaskGraphPayload {
  workspace: {
    startDir: string;
    roots: WorkspaceRootPayload[];
    diagnostics: {
      loadTimings: WorkspaceLoadTiming[];
    };
  };
}

export interface WorkspaceTaskGraphPayloadOptions {
  roots?: DiscoveredForgeRoot[];
  discoverRoots?: (startDir: string) => Promise<DiscoveredForgeRoot[]>;
}

export async function getTaskGraphPayload(
  startDir = process.cwd(),
): Promise<TaskGraphPayload> {
  const repoRoot = await findForgeRoot(startDir);
  const tasks = await loadTasks(repoRoot);
  const analysis = analyzeTasks(tasks);
  const scopeConfig = await getResolvedScopeConfig(repoRoot, tasks);
  const coordinationByTaskId = await getCoordinationByTaskId(repoRoot, tasks);

  return toTaskGraphPayload(repoRoot, tasks, analysis, scopeConfig, coordinationByTaskId);
}

export async function getWorkspaceTaskGraphPayload(
  startDir = process.cwd(),
  options: WorkspaceTaskGraphPayloadOptions = {},
): Promise<WorkspaceTaskGraphPayload> {
  const loadTimings: WorkspaceLoadTiming[] = [];
  const roots = options.roots
    ? measureCachedWorkspaceRoots(loadTimings, startDir, options.roots)
    : await measureWorkspaceLoadPhase(
        loadTimings,
        "workspace.discover_roots",
        () => (options.discoverRoots ?? discoverForgeRootsDownward)(startDir),
        { rootPath: startDir },
      );
  const rootPayloads = await measureWorkspaceLoadPhase(
    loadTimings,
    "workspace.roots_payload",
    () => Promise.all(roots.map((root) => toWorkspaceRootPayload(root, loadTimings))),
    { rootCount: roots.length },
  );
  const selectedRoot = rootPayloads.find((root) => root.status === "ok");
  const selectedGraph = selectedRoot?.graph ?? emptyTaskGraphPayload(startDir);

  return measureWorkspaceLoadPhase(
    loadTimings,
    "workspace.aggregate_payload",
    () => ({
      ...selectedGraph,
      workspace: {
        startDir,
        roots: rootPayloads,
        diagnostics: {
          loadTimings,
        },
      },
    }),
    { rootCount: rootPayloads.length },
  );
}

function measureCachedWorkspaceRoots(
  timings: WorkspaceLoadTiming[],
  startDir: string,
  roots: DiscoveredForgeRoot[],
): DiscoveredForgeRoot[] {
  timings.push({
    phase: "workspace.discover_roots_cache",
    durationMs: 0,
    rootPath: startDir,
    rootCount: roots.length,
  });
  return roots;
}

type CompatibleTaskGraphAnalysis =
  Omit<TaskGraphAnalysis, "availabilityByTaskId"> &
  Partial<Pick<TaskGraphAnalysis, "availabilityByTaskId">>;

export function toTaskGraphPayload(
  repoRoot: string,
  tasks: Task[],
  analysis: CompatibleTaskGraphAnalysis,
  scopeConfig = getInferredScopeConfig(tasks),
  coordinationByTaskId: Record<string, TaskCoordinationPayload> = {},
): TaskGraphPayload {
  const availabilityByTaskId =
    analysis.availabilityByTaskId ?? deriveAvailabilityByTaskId(tasks, analysis);
  return {
    repoRoot,
    tasks,
    readyTaskIds: analysis.readyTaskIds,
    recommendedTaskIds: rankReadyTasks(tasks).map((task) => task.id),
    availabilityByTaskId: Object.fromEntries(availabilityByTaskId.entries()),
    blockersByTaskId: Object.fromEntries(analysis.blockersByTaskId.entries()),
    coordinationByTaskId,
    scopeConfig,
    diagnostics: {
      missingDependencies: analysis.missingDependencies,
      dependencyCycles: analysis.dependencyCycles,
      duplicateTaskIds: analysis.duplicateTaskIds,
    },
  };
}

function deriveAvailabilityByTaskId(
  tasks: Task[],
  analysis: CompatibleTaskGraphAnalysis,
): Map<string, TaskAvailability> {
  const availabilityByTaskId = new Map<string, TaskAvailability>();

  for (const task of tasks) {
    const blockers = analysis.blockersByTaskId.get(task.id) ?? [];
    availabilityByTaskId.set(task.id, classifyTaskAvailability(task, blockers));
  }

  return availabilityByTaskId;
}

async function toWorkspaceRootPayload(
  root: DiscoveredForgeRoot,
  workspaceTimings: WorkspaceLoadTiming[] = [],
): Promise<WorkspaceRootPayload> {
  const timings: WorkspaceLoadTiming[] = [];
  const rootContext = { rootId: root.id, rootPath: root.path };
  try {
    const tasks = await measureWorkspaceLoadPhase(
      timings,
      "root.load_tasks",
      () => loadTasks(root.path),
      rootContext,
    );
    const scopeConfig = await measureWorkspaceLoadPhase(
      timings,
      "root.scope_config",
      () => getResolvedScopeConfig(root.path, tasks),
      rootContext,
    );
    const coordinationByTaskId = await measureWorkspaceLoadPhase(
      timings,
      "root.coordination",
      () => getCoordinationByTaskId(root.path, tasks),
      rootContext,
    );
    const graph = await measureWorkspaceLoadPhase(
      timings,
      "root.graph_payload",
      () =>
        toTaskGraphPayload(
          root.path,
          tasks,
          analyzeTasks(tasks),
          scopeConfig,
          coordinationByTaskId,
        ),
      { ...rootContext, taskCount: tasks.length },
    );
    workspaceTimings.push(...timings);
    return {
      ...root,
      graph,
      status: "ok",
      timings,
      summary: {
        totalTasks: tasks.length,
        readyTaskIds: graph.readyTaskIds,
        recommendedTaskIds: graph.recommendedTaskIds,
        availabilityCounts: countAvailability(graph.availabilityByTaskId),
        diagnostics: graph.diagnostics,
      },
    };
  } catch (error) {
    workspaceTimings.push(...timings);
    return {
      ...root,
      status: "error",
      timings,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function measureWorkspaceLoadPhase<T>(
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
      durationMs: roundDurationMs(performance.now() - start),
      ...context,
    });
  }
}

function roundDurationMs(durationMs: number) {
  return Math.round(durationMs * 100) / 100;
}

function emptyTaskGraphPayload(repoRoot: string): TaskGraphPayload {
  return {
    repoRoot,
    tasks: [],
    readyTaskIds: [],
    recommendedTaskIds: [],
    availabilityByTaskId: {},
    blockersByTaskId: {},
    coordinationByTaskId: {},
    scopeConfig: { source: "inferred", scopes: [] },
    diagnostics: {
      missingDependencies: [],
      dependencyCycles: [],
      duplicateTaskIds: [],
    },
  };
}

async function getResolvedScopeConfig(
  repoRoot: string,
  tasks: Task[],
): Promise<ResolvedScopeConfigPayload> {
  const result = await readScopeConfig(repoRoot);
  if (result.exists) {
    return { source: "configured", scopes: result.config.scopes };
  }
  return getInferredScopeConfig(tasks);
}

function getInferredScopeConfig(tasks: Task[]): ResolvedScopeConfigPayload {
  const pathsByLabel = new Map<string, Set<string>>();
  for (const task of tasks) {
    for (const scopePath of task.scope) {
      const label = inferScopeLabel(scopePath);
      pathsByLabel.set(label, pathsByLabel.get(label) ?? new Set());
      pathsByLabel.get(label)?.add(scopePath);
    }
  }
  return {
    source: "inferred",
    scopes: Array.from(pathsByLabel.entries())
      .sort(([left], [right]) => sortInferredScopeLabels(left, right))
      .map(([label, paths]) => ({
        id: label,
        label,
        paths: Array.from(paths).sort((left, right) => left.localeCompare(right)),
      })),
  };
}

function sortInferredScopeLabels(left: string, right: string) {
  if (left === OTHER_SCOPE) {
    return 1;
  }
  if (right === OTHER_SCOPE) {
    return -1;
  }
  return left.localeCompare(right);
}

async function getCoordinationByTaskId(
  repoRoot: string,
  tasks: Task[],
): Promise<Record<string, TaskCoordinationPayload>> {
  const gitEntries = await readGitStatus(repoRoot);
  if (gitEntries.length === 0) {
    return {};
  }

  return Object.fromEntries(
    tasks.map((task) => {
      const files = classifyWorktreeEntries(repoRoot, tasks, task, gitEntries);
      return [task.id, toCoordinationPayload(files)];
    }),
  );
}

async function readGitStatus(repoRoot: string): Promise<GitStatusEntry[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoRoot, "status", "--porcelain=v1", "-z"],
      { encoding: "utf8" },
    );
    return parsePorcelainStatus(stdout);
  } catch {
    return [];
  }
}

function parsePorcelainStatus(output: string): GitStatusEntry[] {
  const parts = output.split("\0").filter(Boolean);
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const raw = parts[index];
    const status = raw.slice(0, 2);
    const filePath = raw.slice(3);
    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
    entries.push({ path: normalizeGitPath(filePath), status });
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeGitPath(value: string) {
  return value.replace(/\\/g, "/");
}

function toCoordinationPayload(files: WorktreeStatusFile[]): TaskCoordinationPayload {
  return {
    summary: {
      blocking: countCoordinationClass(files, "blocking"),
      review: countCoordinationClass(files, "review"),
      non_blocking: countCoordinationClass(files, "non_blocking"),
      total: files.length,
      clean: files.length === 0,
    },
    files,
    recommendation: recommendWorktreeStatus(files),
  };
}

function countCoordinationClass(
  files: WorktreeStatusFile[],
  classification: WorktreeStatusFile["classification"],
) {
  return files.filter((file) => file.classification === classification).length;
}

function countAvailability(
  availabilityByTaskId: Record<string, TaskAvailability>,
): Record<TaskAvailability, number> {
  const counts: Record<TaskAvailability, number> = {
    active: 0,
    blocked: 0,
    claimed: 0,
    closed: 0,
    ready: 0,
  };
  for (const availability of Object.values(availabilityByTaskId)) {
    counts[availability] += 1;
  }
  return counts;
}

function classifyTaskAvailability(
  task: Task,
  blockers: string[],
): TaskAvailability {
  if (task.status === "done" || task.status === "canceled") {
    return "closed";
  }
  if (blockers.length > 0 || task.status === "blocked") {
    return "blocked";
  }
  if (task.status === "doing") {
    return "active";
  }
  if (task.claimed_by.trim() !== "") {
    return "claimed";
  }
  return "ready";
}
