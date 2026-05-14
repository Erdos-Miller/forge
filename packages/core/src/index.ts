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
