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
  area?: string;
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

export type TaskFrontmatterUpdates = Partial<
  Pick<Task, "status" | "claimed_by" | "updated_at">
>;

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

export class TaskWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskWriteError";
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

export async function findForgeRoot(startDir = process.cwd()): Promise<string> {
  let currentDir = path.resolve(startDir);

  while (true) {
    try {
      const stat = await fs.stat(path.join(currentDir, ".forge"));
      if (stat.isDirectory()) {
        return currentDir;
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new TaskWriteError(`no .forge directory found from ${path.resolve(startDir)}`);
    }
    currentDir = parentDir;
  }
}

export async function loadTasks(repoRoot = process.cwd()): Promise<Task[]> {
  const parsedTasks = await loadParsedTaskFiles(repoRoot);
  return parsedTasks.map((parsedTask) => parsedTask.task);
}

export async function loadTasksFrom(startDir = process.cwd()): Promise<Task[]> {
  return loadTasks(await findForgeRoot(startDir));
}

export async function loadParsedTaskFiles(
  repoRoot = process.cwd(),
): Promise<ParsedTask[]> {
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const entries = await fs.readdir(tasksDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(tasksDir, entry.name))
    .sort();

  const tasks = await Promise.all(
    files.map(async (filePath) => {
      return readTaskFile(filePath);
    }),
  );

  return tasks;
}

export async function readTaskFile(sourcePath: string): Promise<ParsedTask> {
  const contents = await fs.readFile(sourcePath, "utf8");
  return parseTaskFile(sourcePath, contents);
}

export async function findParsedTaskById(
  repoRoot: string,
  taskId: string,
): Promise<ParsedTask> {
  const parsedTasks = await loadParsedTaskFiles(repoRoot);
  const matches = parsedTasks.filter((parsedTask) => parsedTask.task.id === taskId);

  if (matches.length === 0) {
    throw new TaskWriteError(`task ${taskId} not found`);
  }
  if (matches.length > 1) {
    throw new TaskWriteError(`task ${taskId} has duplicate task files`);
  }

  return matches[0];
}

export async function findParsedTaskByIdFrom(
  startDir: string,
  taskId: string,
): Promise<ParsedTask> {
  return findParsedTaskById(await findForgeRoot(startDir), taskId);
}

export async function updateTaskFile(
  sourcePath: string,
  updates: TaskFrontmatterUpdates,
): Promise<Task> {
  const contents = await fs.readFile(sourcePath, "utf8");
  const updatedContents = updateTaskFileContents(contents, updates, sourcePath);
  const parsed = parseTaskFile(sourcePath, updatedContents);
  await fs.writeFile(sourcePath, updatedContents);
  return parsed.task;
}

export function updateTaskFileContents(
  contents: string,
  updates: TaskFrontmatterUpdates,
  sourcePath = "task.md",
): string {
  const { frontmatter, body } = splitFrontmatter(contents, sourcePath);
  let updatedFrontmatter = frontmatter;

  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    updatedFrontmatter = replaceFrontmatterField(
      updatedFrontmatter,
      field,
      serializeFrontmatterScalar(field, value),
      sourcePath,
    );
  }

  return `---\n${updatedFrontmatter}\n---${body}`;
}

export async function claimTask(
  repoRoot: string,
  taskId: string,
  claimedBy: string,
  now = new Date(),
): Promise<Task> {
  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    status: "doing",
    claimed_by: claimedBy,
    updated_at: now.toISOString(),
  });
}

export async function claimTaskFrom(
  startDir: string,
  taskId: string,
  claimedBy: string,
  now = new Date(),
): Promise<Task> {
  return claimTask(await findForgeRoot(startDir), taskId, claimedBy, now);
}

export async function completeTask(
  repoRoot: string,
  taskId: string,
  now = new Date(),
): Promise<Task> {
  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    status: "done",
    claimed_by: "",
    updated_at: now.toISOString(),
  });
}

export async function completeTaskFrom(
  startDir: string,
  taskId: string,
  now = new Date(),
): Promise<Task> {
  return completeTask(await findForgeRoot(startDir), taskId, now);
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

function splitFrontmatter(
  contents: string,
  sourcePath: string,
): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/.exec(contents);
  if (!match) {
    throw new TaskParseError(sourcePath, "missing YAML frontmatter");
  }

  return { frontmatter: match[1], body: match[2] };
}

function replaceFrontmatterField(
  frontmatter: string,
  field: string,
  value: string,
  sourcePath: string,
): string {
  const fieldPattern = new RegExp(`^${escapeRegExp(field)}:.*$`, "m");
  if (!fieldPattern.test(frontmatter)) {
    throw new TaskWriteError(`${sourcePath}: field "${field}" not found`);
  }

  return frontmatter.replace(fieldPattern, `${field}: ${value}`);
}

function serializeFrontmatterScalar(field: string, value: string): string {
  if (field === "claimed_by") {
    return JSON.stringify(value);
  }
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
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
  const area = optionalString(raw, sourcePath, "area");
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
    area,
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

function optionalString(
  raw: Record<string, unknown>,
  sourcePath: string,
  field: string,
): string | undefined {
  const value = raw[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TaskParseError(sourcePath, `field "${field}" must be a string`);
  }
  return value;
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
