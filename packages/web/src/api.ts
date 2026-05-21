import {
  analyzeTasks,
  discoverForgeRootsDownward,
  findForgeRoot,
  loadTasks,
  rankReadyTasks,
  type DiscoveredForgeRoot,
  type Task,
  type TaskGraphAnalysis,
  type TaskAvailability,
} from "../../core/src/index.ts";

export interface TaskGraphPayload {
  repoRoot: string;
  tasks: Task[];
  readyTaskIds: string[];
  recommendedTaskIds: string[];
  availabilityByTaskId: Record<string, TaskAvailability>;
  blockersByTaskId: Record<string, string[]>;
  diagnostics: {
    missingDependencies: Array<{ taskId: string; dependencyId: string }>;
    dependencyCycles: Array<{ taskIds: string[] }>;
    duplicateTaskIds: Array<{ taskId: string; sourcePaths: string[] }>;
  };
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

export async function getTaskGraphPayload(
  startDir = process.cwd(),
): Promise<TaskGraphPayload> {
  const repoRoot = await findForgeRoot(startDir);
  const tasks = await loadTasks(repoRoot);
  const analysis = analyzeTasks(tasks);

  return toTaskGraphPayload(repoRoot, tasks, analysis);
}

export async function getWorkspaceTaskGraphPayload(
  startDir = process.cwd(),
): Promise<WorkspaceTaskGraphPayload> {
  const loadTimings: WorkspaceLoadTiming[] = [];
  const roots = await measureWorkspaceLoadPhase(
    loadTimings,
    "workspace.discover_roots",
    () => discoverForgeRootsDownward(startDir),
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

type CompatibleTaskGraphAnalysis =
  Omit<TaskGraphAnalysis, "availabilityByTaskId"> &
  Partial<Pick<TaskGraphAnalysis, "availabilityByTaskId">>;

export function toTaskGraphPayload(
  repoRoot: string,
  tasks: Task[],
  analysis: CompatibleTaskGraphAnalysis,
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
    const graph = await measureWorkspaceLoadPhase(
      timings,
      "root.graph_payload",
      () => toTaskGraphPayload(root.path, tasks, analyzeTasks(tasks)),
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
    diagnostics: {
      missingDependencies: [],
      dependencyCycles: [],
      duplicateTaskIds: [],
    },
  };
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
