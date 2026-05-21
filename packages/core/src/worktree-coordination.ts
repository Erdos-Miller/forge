import path from "node:path";
import type { Task } from "./types.ts";

export type DirtyClass = "blocking" | "non_blocking" | "review";
export type WorktreeRecommendation = "continue" | "review" | "stop";

export interface GitStatusEntry {
  path: string;
  status: string;
}

export interface WorktreeStatusFile {
  path: string;
  status: string;
  classification: DirtyClass;
  reason: string;
}

export function classifyWorktreeEntries(
  repoRoot: string,
  tasks: Task[],
  task: Task,
  entries: GitStatusEntry[],
): WorktreeStatusFile[] {
  return entries.map((entry) => classifyGitStatusEntry(repoRoot, tasks, task, entry));
}

export function recommendWorktreeStatus(
  files: WorktreeStatusFile[],
): WorktreeRecommendation {
  if (files.some((file) => file.classification === "blocking")) {
    return "stop";
  }
  if (files.some((file) => file.classification === "review")) {
    return "review";
  }
  return "continue";
}

function classifyGitStatusEntry(
  repoRoot: string,
  tasks: Task[],
  task: Task,
  entry: GitStatusEntry,
): WorktreeStatusFile {
  if (entry.path === taskPath(repoRoot, task)) {
    return classify(entry, "review", "claimed_task_file");
  }
  if (dependencyTaskPaths(repoRoot, tasks, task).has(entry.path)) {
    return classify(entry, "review", "dependency_task_file");
  }
  if (isSharedFile(entry.path)) {
    return classify(entry, "review", "shared_file");
  }
  if (isFutureTaskFile(entry.path)) {
    return classify(entry, "non_blocking", "future_task_file");
  }
  if (task.scope.some((scope) => matchesScope(entry.path, scope))) {
    return classify(entry, "blocking", "inside_task_scope");
  }
  return classify(entry, "non_blocking", "outside_task_scope");
}

function classify(
  entry: GitStatusEntry,
  classification: DirtyClass,
  reason: string,
): WorktreeStatusFile {
  return { ...entry, classification, reason };
}

function taskPath(repoRoot: string, task: Task) {
  return normalizePath(path.relative(repoRoot, task.sourcePath));
}

function dependencyTaskPaths(repoRoot: string, tasks: Task[], task: Task) {
  const paths = new Set<string>();
  for (const dependencyId of task.depends_on) {
    const dependency = tasks.find((candidate) => candidate.id === dependencyId);
    if (dependency) {
      paths.add(taskPath(repoRoot, dependency));
    }
  }
  return paths;
}

function isFutureTaskFile(filePath: string) {
  return /^\.forge\/tasks\/[^/]+\.md$/.test(filePath);
}

function isSharedFile(filePath: string) {
  const basename = path.posix.basename(filePath);
  return (
    sharedBasenames.has(basename) ||
    /^\.github\//.test(filePath) ||
    /^[^/]+\.config\.[cm]?[jt]s$/.test(filePath) ||
    /^packages\/[^/]+\/src\/index\.[jt]s$/.test(filePath) ||
    /(^|\/)(dist|build|generated|coverage)\//.test(filePath)
  );
}

const sharedBasenames = new Set([
  "bun.lock",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "yarn.lock",
]);

function matchesScope(filePath: string, scope: string) {
  const normalizedScope = normalizePath(scope);
  if (normalizedScope.endsWith("/**")) {
    return filePath.startsWith(normalizedScope.slice(0, -2));
  }
  const pattern = normalizedScope
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${pattern}$`).test(filePath);
}

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}
