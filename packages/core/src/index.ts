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
  closed_at?: string;
  close_reason?: string;
  body: string;
  sourcePath: string;
}

export interface ParsedTask {
  task: Task;
  frontmatter: Record<string, unknown>;
}

export type TaskFrontmatterUpdates = Partial<
  Pick<Task, "status" | "claimed_by" | "updated_at" | "closed_at" | "close_reason">
>;

export interface CreateTaskInput {
  id: string;
  title: string;
  priority?: TaskPriority;
  area?: string;
  parent?: string;
  depends_on?: string[];
  scope?: string[];
  why?: string;
  success?: string;
  acceptance?: string[];
  verification?: string[];
  notes?: string;
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

export type TaskGraphDiagnostic =
  | ({ kind: "missing_dependency" } & MissingDependencyDiagnostic)
  | ({ kind: "duplicate_task_id" } & DuplicateTaskIdDiagnostic)
  | ({ kind: "dependency_cycle" } & DependencyCycleDiagnostic);

export interface TaskGraphAnalysis {
  tasksById: Map<string, Task>;
  childrenByParent: Map<string, string[]>;
  dependentsById: Map<string, string[]>;
  readyTaskIds: string[];
  blockersByTaskId: Map<string, string[]>;
  downstreamUnblockCountsByTaskId: Map<string, number>;
  diagnostics: TaskGraphDiagnostic[];
  missingDependencies: MissingDependencyDiagnostic[];
  dependencyCycles: DependencyCycleDiagnostic[];
  duplicateTaskIds: DuplicateTaskIdDiagnostic[];
}

export type RankedQueueReason =
  | { kind: "priority"; priority: TaskPriority; rank: number }
  | { kind: "downstream_unblock_count"; count: number }
  | { kind: "no_blockers" };

export interface RankedQueueEntry {
  rank: number;
  task: Task;
  taskId: string;
  priorityRank: number;
  downstreamUnblockCount: number;
  blockers: string[];
  reasons: RankedQueueReason[];
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

export async function createTask(
  repoRoot: string,
  input: CreateTaskInput,
  now = new Date(),
): Promise<Task> {
  if (!input.id.trim()) {
    throw new TaskWriteError("create requires a task id");
  }
  if (!input.title.trim()) {
    throw new TaskWriteError("create requires a title");
  }

  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });

  const existingTasks = await loadTasks(repoRoot);
  if (existingTasks.some((task) => task.id === input.id)) {
    throw new TaskWriteError(`task ${input.id} already exists`);
  }

  const filePath = path.join(tasksDir, `${input.id}-${slugify(input.title)}.md`);
  try {
    await fs.writeFile(filePath, createTaskFileContents(input, now), {
      flag: "wx",
    });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      throw new TaskWriteError(`task file already exists: ${filePath}`);
    }
    throw error;
  }

  return readTaskFile(filePath).then((parsed) => parsed.task);
}

export async function createTaskFrom(
  startDir: string,
  input: CreateTaskInput,
  now = new Date(),
): Promise<Task> {
  return createTask(await findForgeRoot(startDir), input, now);
}

export function createTaskFileContents(input: CreateTaskInput, now = new Date()): string {
  const timestamp = now.toISOString();
  const priority = input.priority ?? "medium";
  const parent = input.parent ?? "";
  const dependsOn = input.depends_on ?? [];
  const scope = input.scope?.length ? input.scope : ["**"];

  const frontmatterLines = [
    "---",
    `id: ${input.id}`,
    `title: ${JSON.stringify(input.title)}`,
    "kind: task",
    "status: open",
    `priority: ${priority}`,
    ...(input.area ? [`area: ${JSON.stringify(input.area)}`] : []),
    `parent: ${JSON.stringify(parent)}`,
    ...formatYamlArray("depends_on", dependsOn),
    `claimed_by: ""`,
    ...formatYamlArray("scope", scope),
    `created_at: ${timestamp}`,
    `updated_at: ${timestamp}`,
    "---",
    "",
  ];

  return `${frontmatterLines.join("\n")}${createTaskBody(input, timestamp)}`;
}

export function createTaskBody(input: CreateTaskInput, timestamp: string): string {
  return [
    `# ${input.title}`,
    "",
    "## Why",
    "",
    input.why?.trim() || "TODO: Explain why this work matters.",
    "",
    "## What success looks like",
    "",
    input.success?.trim() || "TODO: Describe the end state that should be true.",
    "",
    "## Acceptance Criteria",
    "",
    formatMarkdownList(input.acceptance, "TODO: Add observable acceptance criteria."),
    "",
    "## Dependencies",
    "",
    input.depends_on?.length
      ? `Tracked in frontmatter: ${input.depends_on.join(", ")}.`
      : "None.",
    "",
    "## Verification",
    "",
    formatMarkdownList(input.verification, "TODO: Add verification commands or evidence."),
    "",
    "## Notes",
    "",
    input.notes?.trim() || "TODO: Add implementation context.",
    "",
    "## History",
    "",
    `- Created ${timestamp}.`,
    "",
  ].join("\n");
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
    updatedFrontmatter = upsertFrontmatterField(
      updatedFrontmatter,
      field,
      serializeFrontmatterScalar(field, value),
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
  const timestamp = now.toISOString();
  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    status: "done",
    claimed_by: "",
    updated_at: timestamp,
    closed_at: timestamp,
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
  const readyTaskIds: string[] = [];

  for (const task of sortedTasks) {
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
    childrenByParent,
    dependentsById,
    readyTaskIds,
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

function upsertFrontmatterField(
  frontmatter: string,
  field: string,
  value: string,
): string {
  const fieldPattern = new RegExp(`^${escapeRegExp(field)}:.*$`, "m");
  if (!fieldPattern.test(frontmatter)) {
    return `${frontmatter}\n${field}: ${value}`;
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

function formatYamlArray(field: string, values: string[]): string[] {
  if (values.length === 0) {
    return [`${field}: []`];
  }
  return [`${field}:`, ...values.map((value) => `  - ${value}`)];
}

function formatMarkdownList(values: string[] | undefined, fallback: string): string {
  const items = values?.map((value) => value.trim()).filter(Boolean) ?? [];
  if (items.length === 0) {
    return `- ${fallback}`;
  }
  return items.map((value) => `- ${value}`).join("\n");
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "task";
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
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
  const closed_at = optionalTimestamp(raw, sourcePath, "closed_at");
  const close_reason = optionalString(raw, sourcePath, "close_reason");

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
    closed_at,
    close_reason,
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

function optionalTimestamp(
  raw: Record<string, unknown>,
  sourcePath: string,
  field: string,
): string | undefined {
  const value = raw[field];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

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
