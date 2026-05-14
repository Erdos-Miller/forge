import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type TaskKind = "task" | "spec";
export type TaskStatus = "open" | "doing" | "blocked" | "done" | "canceled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  parent: string;
  depends_on: string[];
  claimed_by: string;
  scope: string[];
  created_at: string;
  updated_at: string;
  body: string;
  sourcePath: string;
}

export interface ParsedTask {
  task: Task;
  frontmatter: Record<string, unknown>;
}

export interface MissingDependencyDiagnostic {
  taskId: string;
  dependencyId: string;
}

export interface DuplicateTaskIdDiagnostic {
  taskId: string;
  sourcePaths: string[];
}

export interface DependencyCycleDiagnostic {
  taskIds: string[];
}

export interface TaskGraphAnalysis {
  tasksById: Map<string, Task>;
  readyTaskIds: string[];
  blockersByTaskId: Map<string, string[]>;
  missingDependencies: MissingDependencyDiagnostic[];
  dependencyCycles: DependencyCycleDiagnostic[];
  duplicateTaskIds: DuplicateTaskIdDiagnostic[];
}

export class TaskParseError extends Error {
  readonly sourcePath: string;

  constructor(sourcePath: string, message: string) {
    super(`${sourcePath}: ${message}`);
    this.name = "TaskParseError";
    this.sourcePath = sourcePath;
  }
}

const TASK_STATUSES = new Set<TaskStatus>([
  "open",
  "doing",
  "blocked",
  "done",
  "canceled",
]);

const TASK_PRIORITIES = new Set<TaskPriority>([
  "urgent",
  "high",
  "medium",
  "low",
]);

const TASK_KINDS = new Set<TaskKind>(["task", "spec"]);

export async function loadTasks(repoRoot = process.cwd()): Promise<Task[]> {
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const entries = await fs.readdir(tasksDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(tasksDir, entry.name))
    .sort();

  const tasks = await Promise.all(
    files.map(async (filePath) => {
      const contents = await fs.readFile(filePath, "utf8");
      return parseTaskFile(filePath, contents).task;
    }),
  );

  return tasks;
}

export function analyzeTasks(tasks: Task[]): TaskGraphAnalysis {
  const tasksById = new Map<string, Task>();
  const sourcePathsByTaskId = new Map<string, string[]>();

  for (const task of tasks) {
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

  const missingDependencies = findMissingDependencies(tasks, tasksById);
  const missingByTaskId = groupMissingDependencies(missingDependencies);
  const dependencyCycles = findDependencyCycles(tasksById);
  const cycleMessagesByTaskId = groupCycleMessages(dependencyCycles);

  const blockersByTaskId = new Map<string, string[]>();
  const readyTaskIds: string[] = [];

  for (const task of tasks) {
    const blockers = getTaskBlockersFromDiagnostics(
      task,
      tasksById,
      duplicateIds,
      missingByTaskId,
      cycleMessagesByTaskId,
    );
    blockersByTaskId.set(task.id, blockers);

    if (blockers.length === 0) {
      readyTaskIds.push(task.id);
    }
  }

  return {
    tasksById,
    readyTaskIds,
    blockersByTaskId,
    missingDependencies,
    dependencyCycles,
    duplicateTaskIds,
  };
}

export function getReadyTasks(tasks: Task[]): Task[] {
  const analysis = analyzeTasks(tasks);
  return tasks.filter((task) => analysis.readyTaskIds.includes(task.id));
}

export function getTaskBlockers(
  task: Task,
  analysis: TaskGraphAnalysis,
): string[] {
  return analysis.blockersByTaskId.get(task.id) ?? [];
}

export function parseTaskFile(sourcePath: string, contents: string): ParsedTask {
  if (!contents.startsWith("---\n") && !contents.startsWith("---\r\n")) {
    throw new TaskParseError(sourcePath, "missing YAML frontmatter");
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TaskParseError(sourcePath, `malformed YAML frontmatter: ${message}`);
  }

  const frontmatter = parsed.data as Record<string, unknown>;
  const task = validateTask(frontmatter, sourcePath, parsed.content);
  return { task, frontmatter };
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

function getTaskBlockersFromDiagnostics(
  task: Task,
  tasksById: Map<string, Task>,
  duplicateIds: Set<string>,
  missingByTaskId: Map<string, string[]>,
  cycleMessagesByTaskId: Map<string, string[]>,
): string[] {
  const blockers: string[] = [];

  if (task.status !== "open") {
    blockers.push(`status is ${task.status}`);
  }

  if (task.claimed_by.trim() !== "") {
    blockers.push(`claimed by ${task.claimed_by}`);
  }

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

export function validateTask(
  raw: Record<string, unknown>,
  sourcePath: string,
  body = "",
): Task {
  const id = requireString(raw, sourcePath, "id");
  const title = requireString(raw, sourcePath, "title");
  const kind = requireEnum(raw, sourcePath, "kind", TASK_KINDS);
  const status = requireEnum(raw, sourcePath, "status", TASK_STATUSES);
  const priority = requireEnum(raw, sourcePath, "priority", TASK_PRIORITIES);
  const parent = requireString(raw, sourcePath, "parent");
  const depends_on = requireStringArray(raw, sourcePath, "depends_on");
  const claimed_by = requireString(raw, sourcePath, "claimed_by");
  const scope = requireStringArray(raw, sourcePath, "scope");
  const created_at = requireTimestamp(raw, sourcePath, "created_at");
  const updated_at = requireTimestamp(raw, sourcePath, "updated_at");

  return {
    id,
    title,
    kind,
    status,
    priority,
    parent,
    depends_on,
    claimed_by,
    scope,
    created_at,
    updated_at,
    body,
    sourcePath,
  };
}

function requireString(
  raw: Record<string, unknown>,
  sourcePath: string,
  field: string,
): string {
  const value = raw[field];
  if (typeof value !== "string") {
    throw new TaskParseError(sourcePath, `field "${field}" must be a string`);
  }
  return value;
}

function requireStringArray(
  raw: Record<string, unknown>,
  sourcePath: string,
  field: string,
): string[] {
  const value = raw[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TaskParseError(sourcePath, `field "${field}" must be an array of strings`);
  }
  return value;
}

function requireTimestamp(
  raw: Record<string, unknown>,
  sourcePath: string,
  field: string,
): string {
  const value = raw[field];
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "string") {
    throw new TaskParseError(sourcePath, `field "${field}" must be a string timestamp`);
  }

  if (Number.isNaN(Date.parse(value))) {
    throw new TaskParseError(sourcePath, `field "${field}" must be a parseable timestamp`);
  }
  return value;
}

function requireEnum<T extends string>(
  raw: Record<string, unknown>,
  sourcePath: string,
  field: string,
  allowed: Set<T>,
): T {
  const value = requireString(raw, sourcePath, field);
  if (!allowed.has(value as T)) {
    throw new TaskParseError(
      sourcePath,
      `field "${field}" must be one of: ${Array.from(allowed).join(", ")}`,
    );
  }
  return value as T;
}
