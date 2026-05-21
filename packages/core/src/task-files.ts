import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  TaskParseError,
  TaskWriteError,
  type CreateTaskInput,
  type ParsedTask,
  type Task,
  type TaskFrontmatterUpdates,
  type TaskKind,
  type TaskPriority,
  type TaskStatus,
} from "./types.ts";

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

export const EXPECTED_TASK_MARKDOWN_FIELDS = [
  "Why",
  "What success looks like",
  "Acceptance Criteria",
  "Verification",
  "Notes",
] as const;

export const SUPPORTED_TASK_MARKDOWN_SECTIONS = [
  ...EXPECTED_TASK_MARKDOWN_FIELDS.slice(0, 3),
  "Execution Plan",
  "Dependencies",
  ...EXPECTED_TASK_MARKDOWN_FIELDS.slice(3),
  "History",
] as const;

export interface DiscoveredForgeRoot {
  id: string;
  displayName: string;
  path: string;
  taskCount: number;
}

const WORKSPACE_DISCOVERY_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
]);

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

export async function discoverForgeRootsDownward(
  startDir: string,
): Promise<DiscoveredForgeRoot[]> {
  const resolvedStartDir = path.resolve(startDir);
  const roots: DiscoveredForgeRoot[] = [];
  await walkForForgeRoots(resolvedStartDir, resolvedStartDir, roots);
  return roots.sort((left, right) => left.id.localeCompare(right.id));
}

async function walkForForgeRoots(
  startDir: string,
  currentDir: string,
  roots: DiscoveredForgeRoot[],
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const hasForgeDir = entries.some((entry) => entry.isDirectory() && entry.name === ".forge");

  if (hasForgeDir) {
    roots.push(await toDiscoveredForgeRoot(startDir, currentDir));
    return;
  }

  const childDirs = entries
    .filter((entry) => entry.isDirectory() && !WORKSPACE_DISCOVERY_IGNORED_DIRS.has(entry.name))
    .map((entry) => path.join(currentDir, entry.name))
    .sort();

  for (const childDir of childDirs) {
    await walkForForgeRoots(startDir, childDir, roots);
  }
}

async function toDiscoveredForgeRoot(
  startDir: string,
  repoRoot: string,
): Promise<DiscoveredForgeRoot> {
  const resolvedRoot = await fs.realpath(repoRoot);
  const relativePath = normalizeRootId(path.relative(startDir, repoRoot));
  return {
    id: relativePath || ".",
    displayName: relativePath ? path.basename(repoRoot) : path.basename(resolvedRoot),
    path: resolvedRoot,
    taskCount: await countTaskMarkdownFiles(path.join(repoRoot, ".forge", "tasks")),
  };
}

async function countTaskMarkdownFiles(tasksDir: string): Promise<number> {
  try {
    const entries = await fs.readdir(tasksDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      const entryPath = path.join(tasksDir, entry.name);
      if (entry.isDirectory()) {
        count += await countTaskMarkdownFiles(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        count += 1;
      }
    }
    return count;
  } catch (error) {
    if (isNotFoundError(error)) {
      return 0;
    }
    throw error;
  }
}

function normalizeRootId(relativePath: string): string {
  return relativePath.split(path.sep).filter(Boolean).join("/");
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
  await writeFileAtomic(sourcePath, updatedContents);
  return parsed.task;
}

export function updateTaskFileContents(
  contents: string,
  updates: TaskFrontmatterUpdates,
  sourcePath = "task.md",
): string {
  assertSafeTaskFileContents(contents, sourcePath);
  const { frontmatter, body } = splitFrontmatter(contents, sourcePath);
  let updatedFrontmatter = frontmatter;

  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    updatedFrontmatter = upsertFrontmatterField(
      updatedFrontmatter,
      field,
      serializeFrontmatterValue(field, value),
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
  reason = "",
): Promise<Task> {
  const timestamp = now.toISOString();
  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    status: "done",
    claimed_by: "",
    updated_at: timestamp,
    closed_at: timestamp,
    close_reason: reason,
    blocked_reason: "",
    review_reason: "",
  });
}

export async function completeTaskFrom(
  startDir: string,
  taskId: string,
  now = new Date(),
  reason = "",
): Promise<Task> {
  return completeTask(await findForgeRoot(startDir), taskId, now, reason);
}

export async function blockTask(
  repoRoot: string,
  taskId: string,
  reason: string,
  now = new Date(),
): Promise<Task> {
  if (!reason.trim()) {
    throw new TaskWriteError("block requires a reason");
  }

  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    status: "blocked",
    blocked_reason: reason,
    updated_at: now.toISOString(),
  });
}

export async function blockTaskFrom(
  startDir: string,
  taskId: string,
  reason: string,
  now = new Date(),
): Promise<Task> {
  return blockTask(await findForgeRoot(startDir), taskId, reason, now);
}

export async function unblockTask(
  repoRoot: string,
  taskId: string,
  now = new Date(),
): Promise<Task> {
  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    status: "open",
    blocked_reason: "",
    updated_at: now.toISOString(),
  });
}

export async function unblockTaskFrom(
  startDir: string,
  taskId: string,
  now = new Date(),
): Promise<Task> {
  return unblockTask(await findForgeRoot(startDir), taskId, now);
}

export async function requestTaskReview(
  repoRoot: string,
  taskId: string,
  reason: string,
  now = new Date(),
): Promise<Task> {
  if (!reason.trim()) {
    throw new TaskWriteError("review requires a reason");
  }

  const parsed = await findParsedTaskById(repoRoot, taskId);
  return updateTaskFile(parsed.task.sourcePath, {
    review_reason: reason,
    updated_at: now.toISOString(),
  });
}

export async function requestTaskReviewFrom(
  startDir: string,
  taskId: string,
  reason: string,
  now = new Date(),
): Promise<Task> {
  return requestTaskReview(await findForgeRoot(startDir), taskId, reason, now);
}

export async function appendTaskNote(
  repoRoot: string,
  taskId: string,
  note: string,
  now = new Date(),
): Promise<Task> {
  if (!note.trim()) {
    throw new TaskWriteError("note requires non-empty stdin");
  }

  const parsed = await findParsedTaskById(repoRoot, taskId);
  const contents = await fs.readFile(parsed.task.sourcePath, "utf8");
  const notedContents = appendToMarkdownSection(
    contents,
    "Notes",
    note.trim(),
    parsed.task.sourcePath,
  );
  const updatedContents = updateTaskFileContents(
    notedContents,
    {
      updated_at: now.toISOString(),
    },
    parsed.task.sourcePath,
  );
  const updated = parseTaskFile(parsed.task.sourcePath, updatedContents);
  await writeFileAtomic(parsed.task.sourcePath, updatedContents);
  return updated.task;
}

export async function appendTaskNoteFrom(
  startDir: string,
  taskId: string,
  note: string,
  now = new Date(),
): Promise<Task> {
  return appendTaskNote(await findForgeRoot(startDir), taskId, note, now);
}

export async function upsertTaskExecutionPlan(
  repoRoot: string,
  taskId: string,
  plan: string,
  now = new Date(),
): Promise<Task> {
  if (!plan.trim()) {
    throw new TaskWriteError("plan requires non-empty stdin");
  }

  const parsed = await findParsedTaskById(repoRoot, taskId);
  const contents = await fs.readFile(parsed.task.sourcePath, "utf8");
  const plannedContents = upsertMarkdownSection(
    contents,
    "Execution Plan",
    plan.trim(),
    ["Dependencies", "Verification", "Notes", "History"],
    parsed.task.sourcePath,
  );
  const updatedContents = updateTaskFileContents(
    plannedContents,
    {
      updated_at: now.toISOString(),
    },
    parsed.task.sourcePath,
  );
  const updated = parseTaskFile(parsed.task.sourcePath, updatedContents);
  await writeFileAtomic(parsed.task.sourcePath, updatedContents);
  return updated.task;
}

export async function upsertTaskExecutionPlanFrom(
  startDir: string,
  taskId: string,
  plan: string,
  now = new Date(),
): Promise<Task> {
  return upsertTaskExecutionPlan(await findForgeRoot(startDir), taskId, plan, now);
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

function assertSafeTaskFileContents(contents: string, sourcePath: string): void {
  if (contents.includes("<<<<<<<") || contents.includes("=======") || contents.includes(">>>>>>>")) {
    throw new TaskWriteError(`${sourcePath}: task file contains merge conflict markers`);
  }
}

function appendToMarkdownSection(
  contents: string,
  sectionTitle: string,
  text: string,
  sourcePath = "task.md",
): string {
  const { frontmatter, body } = splitFrontmatter(contents, sourcePath);
  const headingPattern = new RegExp(`^## ${escapeRegExp(sectionTitle)}\\s*$`, "m");
  const headingMatch = headingPattern.exec(body);

  if (!headingMatch) {
    return `---\n${frontmatter}\n---${body.trimEnd()}\n\n## ${sectionTitle}\n\n${text}\n`;
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = body.slice(sectionStart);
  const nextHeadingMatch = /^## .*/m.exec(rest);
  const insertAt = nextHeadingMatch ? sectionStart + nextHeadingMatch.index : body.length;
  const before = body.slice(0, insertAt).trimEnd();
  const after = body.slice(insertAt);

  return `---\n${frontmatter}\n---${before}\n\n${text}\n\n${after}`;
}

function upsertMarkdownSection(
  contents: string,
  sectionTitle: string,
  text: string,
  insertBeforeTitles: string[],
  sourcePath = "task.md",
): string {
  const { frontmatter, body } = splitFrontmatter(contents, sourcePath);
  const headingPattern = new RegExp(`^## ${escapeRegExp(sectionTitle)}\\s*$`, "m");
  const headingMatch = headingPattern.exec(body);
  const section = `## ${sectionTitle}\n\n${text}\n`;

  if (headingMatch) {
    const sectionStart = headingMatch.index + headingMatch[0].length;
    const rest = body.slice(sectionStart);
    const nextHeadingMatch = /^## .*/m.exec(rest);
    const sectionEnd = nextHeadingMatch
      ? sectionStart + nextHeadingMatch.index
      : body.length;
    return replaceBodySection(frontmatter, body, headingMatch.index, sectionEnd, section);
  }

  const insertAt = findFirstSectionIndex(body, insertBeforeTitles) ?? body.length;
  return replaceBodySection(frontmatter, body, insertAt, insertAt, section);
}

function findFirstSectionIndex(body: string, sectionTitles: string[]): number | undefined {
  const indexes = sectionTitles
    .map((title) => new RegExp(`^## ${escapeRegExp(title)}\\s*$`, "m").exec(body)?.index)
    .filter((index): index is number => index !== undefined);

  return indexes.length ? Math.min(...indexes) : undefined;
}

function replaceBodySection(
  frontmatter: string,
  body: string,
  start: number,
  end: number,
  section: string,
): string {
  const before = body.slice(0, start).trimEnd();
  const after = body.slice(end).trimStart();
  return `---\n${frontmatter}\n---${before}\n\n${section}${after ? `\n${after}` : ""}`;
}

function upsertFrontmatterField(
  frontmatter: string,
  field: string,
  valueLines: string[],
): string {
  const lines = frontmatter.split(/\r?\n/);
  const fieldIndex = lines.findIndex((line) => line.startsWith(`${field}:`));

  if (fieldIndex === -1) {
    return `${frontmatter}\n${valueLines.join("\n")}`;
  }

  let endIndex = fieldIndex + 1;
  while (endIndex < lines.length && /^\s+/.test(lines[endIndex])) {
    endIndex += 1;
  }
  lines.splice(fieldIndex, endIndex - fieldIndex, ...valueLines);
  return lines.join("\n");
}

function serializeFrontmatterValue(field: string, value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return formatYamlArray(field, value);
  }

  if (
    field === "claimed_by" ||
    field === "area" ||
    field === "close_reason" ||
    field === "blocked_reason" ||
    field === "review_reason"
  ) {
    return [`${field}: ${JSON.stringify(value)}`];
  }
  return [`${field}: ${value}`];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatYamlArray(field: string, values: string[]): string[] {
  if (values.length === 0) {
    return [`${field}: []`];
  }
  return [`${field}:`, ...values.map((value) => `  - ${JSON.stringify(value)}`)];
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

async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    await fs.writeFile(tempPath, contents, { flag: "wx" });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
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
  const blocked_reason = optionalString(raw, sourcePath, "blocked_reason");
  const review_reason = optionalString(raw, sourcePath, "review_reason");

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
    blocked_reason,
    review_reason,
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
  if (value === undefined || value === null) {
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
