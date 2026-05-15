import { TaskWriteError, type DependencyEditResult, type Task } from "./types.ts";
import { findForgeRoot, loadTasks, updateTaskFile } from "./task-files.ts";
import { analyzeTasks } from "./graph.ts";

export async function addTaskDependency(
  repoRoot: string,
  taskId: string,
  dependencyId: string,
  now = new Date(),
): Promise<DependencyEditResult> {
  const { task, tasks } = await getDependencyEditContext(repoRoot, taskId, dependencyId);
  if (task.depends_on.includes(dependencyId)) {
    return { task, changed: false, reason: "already_present" };
  }

  const nextTask = { ...task, depends_on: [...task.depends_on, dependencyId] };
  assertNoDependencyCycle(
    tasks.map((candidate) => (candidate.id === task.id ? nextTask : candidate)),
  );

  const updatedTask = await updateTaskFile(task.sourcePath, {
    depends_on: nextTask.depends_on,
    updated_at: now.toISOString(),
  });
  return { task: updatedTask, changed: true, reason: "added" };
}

export async function addTaskDependencyFrom(
  startDir: string,
  taskId: string,
  dependencyId: string,
  now = new Date(),
): Promise<DependencyEditResult> {
  return addTaskDependency(await findForgeRoot(startDir), taskId, dependencyId, now);
}

export async function removeTaskDependency(
  repoRoot: string,
  taskId: string,
  dependencyId: string,
  now = new Date(),
): Promise<DependencyEditResult> {
  const { task } = await getDependencyEditContext(repoRoot, taskId, dependencyId);
  if (!task.depends_on.includes(dependencyId)) {
    return { task, changed: false, reason: "absent" };
  }

  const updatedTask = await updateTaskFile(task.sourcePath, {
    depends_on: task.depends_on.filter((candidate) => candidate !== dependencyId),
    updated_at: now.toISOString(),
  });
  return { task: updatedTask, changed: true, reason: "removed" };
}

export async function removeTaskDependencyFrom(
  startDir: string,
  taskId: string,
  dependencyId: string,
  now = new Date(),
): Promise<DependencyEditResult> {
  return removeTaskDependency(await findForgeRoot(startDir), taskId, dependencyId, now);
}

async function getDependencyEditContext(
  repoRoot: string,
  taskId: string,
  dependencyId: string,
): Promise<{ task: Task; tasks: Task[] }> {
  if (!taskId.trim()) {
    throw new TaskWriteError("dependency edit requires a task id");
  }
  if (!dependencyId.trim()) {
    throw new TaskWriteError("dependency edit requires a dependency id");
  }
  if (taskId === dependencyId) {
    throw new TaskWriteError(`dependency edit would create a cycle: ${taskId} -> ${taskId}`);
  }

  const tasks = await loadTasks(repoRoot);
  const analysis = analyzeTasks(tasks);
  const task = analysis.tasksById.get(taskId);
  if (!task) {
    throw new TaskWriteError(`task ${taskId} not found`);
  }
  if (!analysis.tasksById.has(dependencyId)) {
    throw new TaskWriteError(`task ${dependencyId} not found`);
  }
  return { task, tasks };
}

function assertNoDependencyCycle(tasks: Task[]): void {
  const cycles = analyzeTasks(tasks).dependencyCycles;
  if (cycles.length === 0) {
    return;
  }

  throw new TaskWriteError(
    `dependency edit would create a cycle: ${cycles[0].taskIds.join(" -> ")}`,
  );
}
