import {
  analyzeTasks,
  findForgeRoot,
  loadTasks,
  rankReadyTasks,
  type Task,
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

  return {
    repoRoot,
    tasks,
    readyTaskIds: analysis.readyTaskIds,
    recommendedTaskIds: rankReadyTasks(tasks).map((task) => task.id),
    availabilityByTaskId: Object.fromEntries(analysis.availabilityByTaskId.entries()),
    blockersByTaskId: Object.fromEntries(analysis.blockersByTaskId.entries()),
    diagnostics: {
      missingDependencies: analysis.missingDependencies,
      dependencyCycles: analysis.dependencyCycles,
      duplicateTaskIds: analysis.duplicateTaskIds,
    },
  };
}
