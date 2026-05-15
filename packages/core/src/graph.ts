import {
  type DependencyCycleDiagnostic,
  type DuplicateTaskIdDiagnostic,
  type MissingDependencyDiagnostic,
  type RankedQueueEntry,
  type RankedQueueReason,
  type Task,
  type TaskAvailability,
  type TaskGraphAnalysis,
  type TaskGraphDiagnostic,
  type TaskPriority,
} from "./types.ts";

export function analyzeTasks(tasks: Task[]): TaskGraphAnalysis {
  const tasksById = new Map<string, Task>();
  const sourcePathsByTaskId = new Map<string, string[]>();
  const sortedTasks = tasks.slice().sort(compareTasks);

  for (const task of sortedTasks) {
    const sourcePaths = sourcePathsByTaskId.get(task.id) ?? [];
    sourcePaths.push(task.sourcePath);
    sourcePathsByTaskId.set(task.id, sourcePaths);

    if (!tasksById.has(task.id)) {
      tasksById.set(task.id, task);
    }
  }

  const duplicateTaskIds: DuplicateTaskIdDiagnostic[] = Array.from(
    sourcePathsByTaskId.entries(),
  )
    .filter(([, sourcePaths]) => sourcePaths.length > 1)
    .map(([taskId, sourcePaths]) => ({ taskId, sourcePaths }));
  const duplicateIds = new Set(duplicateTaskIds.map((diagnostic) => diagnostic.taskId));

  const childrenByParent = buildChildrenByParent(sortedTasks);
  const dependentsById = buildDependentsById(sortedTasks);
  const downstreamUnblockCountsByTaskId =
    countDownstreamUnblocks(tasksById, dependentsById);
  const missingDependencies = findMissingDependencies(sortedTasks, tasksById);
  const missingByTaskId = groupMissingDependencies(missingDependencies);
  const dependencyCycles = findDependencyCycles(tasksById);
  const cycleMessagesByTaskId = groupCycleMessages(dependencyCycles);
  const diagnostics = buildTaskGraphDiagnostics(
    missingDependencies,
    duplicateTaskIds,
    dependencyCycles,
  );

  const blockersByTaskId = new Map<string, string[]>();
  const availabilityByTaskId = new Map<string, TaskAvailability>();
  const readyTaskIds: string[] = [];

  for (const task of sortedTasks) {
    const blockers = getTaskProblemBlockers(
      task,
      tasksById,
      duplicateIds,
      missingByTaskId,
      cycleMessagesByTaskId,
    );
    const availability = classifyTaskAvailability(task, blockers);
    blockersByTaskId.set(task.id, blockers);
    availabilityByTaskId.set(task.id, availability);

    if (availability === "ready") {
      readyTaskIds.push(task.id);
    }
  }

  return {
    tasksById,
    childrenByParent,
    dependentsById,
    readyTaskIds,
    availabilityByTaskId,
    blockersByTaskId,
    downstreamUnblockCountsByTaskId,
    diagnostics,
    missingDependencies,
    dependencyCycles,
    duplicateTaskIds,
  };
}

export function getReadyTasks(tasks: Task[]): Task[] {
  const analysis = analyzeTasks(tasks);
  return tasks.filter((task) => analysis.readyTaskIds.includes(task.id));
}

export function rankReadyTasks(tasks: Task[]): Task[] {
  return rankReadyTaskQueue(tasks).map((entry) => entry.task);
}

export function rankReadyTaskQueue(tasks: Task[]): RankedQueueEntry[] {
  const analysis = analyzeTasks(tasks);
  const readyTaskIds = new Set(analysis.readyTaskIds);

  return tasks
    .filter((task) => readyTaskIds.has(task.id))
    .map((task) => createRankedQueueEntry(task, analysis))
    .sort(compareRankedQueueEntries)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getTaskBlockers(
  task: Task,
  analysis: TaskGraphAnalysis,
): string[] {
  return analysis.blockersByTaskId.get(task.id) ?? [];
}

export function getTaskAvailability(
  task: Task,
  analysis: TaskGraphAnalysis,
): TaskAvailability {
  return analysis.availabilityByTaskId.get(task.id) ?? "blocked";
}

function findMissingDependencies(
  tasks: Task[],
  tasksById: Map<string, Task>,
): MissingDependencyDiagnostic[] {
  const missingDependencies: MissingDependencyDiagnostic[] = [];

  for (const task of tasks) {
    for (const dependencyId of task.depends_on) {
      if (!tasksById.has(dependencyId)) {
        missingDependencies.push({ taskId: task.id, dependencyId });
      }
    }
  }

  return missingDependencies;
}

function buildChildrenByParent(tasks: Task[]): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>();

  for (const task of tasks) {
    if (!task.parent.trim()) {
      continue;
    }
    const children = childrenByParent.get(task.parent) ?? [];
    children.push(task.id);
    childrenByParent.set(task.parent, children);
  }

  return sortStringArrayMap(childrenByParent);
}

function buildDependentsById(tasks: Task[]): Map<string, string[]> {
  const dependentsById = new Map<string, string[]>();

  for (const task of tasks) {
    for (const dependencyId of task.depends_on) {
      const dependents = dependentsById.get(dependencyId) ?? [];
      dependents.push(task.id);
      dependentsById.set(dependencyId, dependents);
    }
  }

  return sortStringArrayMap(dependentsById);
}

function countDownstreamUnblocks(
  tasksById: Map<string, Task>,
  dependentsById: Map<string, string[]>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const taskId of Array.from(tasksById.keys()).sort()) {
    const downstreamTaskIds = new Set<string>();
    collectDownstreamDependents(taskId, dependentsById, downstreamTaskIds);
    counts.set(taskId, downstreamTaskIds.size);
  }

  return counts;
}

function collectDownstreamDependents(
  taskId: string,
  dependentsById: Map<string, string[]>,
  downstreamTaskIds: Set<string>,
): void {
  for (const dependentId of dependentsById.get(taskId) ?? []) {
    if (downstreamTaskIds.has(dependentId)) {
      continue;
    }
    downstreamTaskIds.add(dependentId);
    collectDownstreamDependents(dependentId, dependentsById, downstreamTaskIds);
  }
}

function buildTaskGraphDiagnostics(
  missingDependencies: MissingDependencyDiagnostic[],
  duplicateTaskIds: DuplicateTaskIdDiagnostic[],
  dependencyCycles: DependencyCycleDiagnostic[],
): TaskGraphDiagnostic[] {
  return [
    ...missingDependencies.map((diagnostic) => ({
      kind: "missing_dependency" as const,
      ...diagnostic,
    })),
    ...duplicateTaskIds.map((diagnostic) => ({
      kind: "duplicate_task_id" as const,
      ...diagnostic,
    })),
    ...dependencyCycles.map((diagnostic) => ({
      kind: "dependency_cycle" as const,
      ...diagnostic,
    })),
  ];
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

function sortStringArrayMap(map: Map<string, string[]>): Map<string, string[]> {
  return new Map(
    Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, values.slice().sort()]),
  );
}

function groupMissingDependencies(
  diagnostics: MissingDependencyDiagnostic[],
): Map<string, string[]> {
  const byTaskId = new Map<string, string[]>();

  for (const diagnostic of diagnostics) {
    const dependencies = byTaskId.get(diagnostic.taskId) ?? [];
    dependencies.push(diagnostic.dependencyId);
    byTaskId.set(diagnostic.taskId, dependencies);
  }

  return byTaskId;
}

function findDependencyCycles(tasksById: Map<string, Task>): DependencyCycleDiagnostic[] {
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  const cycles: DependencyCycleDiagnostic[] = [];
  const seenCycles = new Set<string>();

  function visit(taskId: string): void {
    const currentState = state.get(taskId);
    if (currentState === "visited") {
      return;
    }
    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(taskId);
      const taskIds = stack.slice(cycleStart).concat(taskId);
      const key = canonicalCycleKey(taskIds);
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        cycles.push({ taskIds });
      }
      return;
    }

    const task = tasksById.get(taskId);
    if (!task) {
      return;
    }

    state.set(taskId, "visiting");
    stack.push(taskId);

    for (const dependencyId of task.depends_on) {
      if (tasksById.has(dependencyId)) {
        visit(dependencyId);
      }
    }

    stack.pop();
    state.set(taskId, "visited");
  }

  for (const taskId of tasksById.keys()) {
    visit(taskId);
  }

  return cycles;
}

function canonicalCycleKey(taskIds: string[]): string {
  const cycle = taskIds.slice(0, -1);
  if (cycle.length === 0) {
    return "";
  }

  const rotations = cycle.map((_, index) =>
    cycle.slice(index).concat(cycle.slice(0, index)).join("->"),
  );
  return rotations.sort()[0];
}

function groupCycleMessages(
  cycles: DependencyCycleDiagnostic[],
): Map<string, string[]> {
  const byTaskId = new Map<string, string[]>();

  for (const cycle of cycles) {
    const message = `dependency cycle: ${cycle.taskIds.join(" -> ")}`;
    for (const taskId of new Set(cycle.taskIds)) {
      const messages = byTaskId.get(taskId) ?? [];
      messages.push(message);
      byTaskId.set(taskId, messages);
    }
  }

  return byTaskId;
}

function getTaskProblemBlockers(
  task: Task,
  tasksById: Map<string, Task>,
  duplicateIds: Set<string>,
  missingByTaskId: Map<string, string[]>,
  cycleMessagesByTaskId: Map<string, string[]>,
): string[] {
  const blockers: string[] = [];

  if (duplicateIds.has(task.id)) {
    blockers.push(`duplicate task id ${task.id}`);
  }

  for (const dependencyId of missingByTaskId.get(task.id) ?? []) {
    blockers.push(`missing dependency ${dependencyId}`);
  }

  for (const dependencyId of task.depends_on) {
    const dependency = tasksById.get(dependencyId);
    if (!dependency) {
      continue;
    }
    if (dependency.status !== "done" && dependency.status !== "canceled") {
      blockers.push(`dependency ${dependencyId} is ${dependency.status}`);
    }
  }

  blockers.push(...(cycleMessagesByTaskId.get(task.id) ?? []));

  return blockers;
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

function createRankedQueueEntry(
  task: Task,
  analysis: TaskGraphAnalysis,
): RankedQueueEntry {
  const taskPriorityRank = priorityRank(task.priority);
  const downstreamUnblockCount =
    analysis.downstreamUnblockCountsByTaskId.get(task.id) ?? 0;
  const blockers = analysis.blockersByTaskId.get(task.id) ?? [];

  return {
    rank: 0,
    task,
    taskId: task.id,
    priorityRank: taskPriorityRank,
    downstreamUnblockCount,
    blockers,
    reasons: [
      { kind: "priority", priority: task.priority, rank: taskPriorityRank },
      { kind: "downstream_unblock_count", count: downstreamUnblockCount },
      { kind: "no_blockers" },
    ],
  };
}

function compareRankedQueueEntries(
  left: RankedQueueEntry,
  right: RankedQueueEntry,
): number {
  const priorityDelta = left.priorityRank - right.priorityRank;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const downstreamDelta =
    right.downstreamUnblockCount - left.downstreamUnblockCount;
  if (downstreamDelta !== 0) {
    return downstreamDelta;
  }

  return left.taskId.localeCompare(right.taskId);
}

function priorityRank(priority: TaskPriority): number {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
  }
}

function compareTasks(left: Task, right: Task): number {
  const idDelta = left.id.localeCompare(right.id);
  if (idDelta !== 0) {
    return idDelta;
  }
  return left.sourcePath.localeCompare(right.sourcePath);
}
