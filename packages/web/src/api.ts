import {
  analyzeTasks,
  findForgeRoot,
  loadTasks,
  rankReadyTasks,
  type Task,
  type TaskGraphAnalysis,
  type TaskAvailability,
} from "@forge/core";

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

export async function getTaskGraphPayload(
  startDir = process.cwd(),
): Promise<TaskGraphPayload> {
  const repoRoot = await findForgeRoot(startDir);
  const tasks = await loadTasks(repoRoot);
  const analysis = analyzeTasks(tasks);

  return toTaskGraphPayload(repoRoot, tasks, analysis);
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
