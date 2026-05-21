import path from "node:path";
import type { Task } from "@forge/core";
import { toRobotTaskSummary } from "./robot";

export type DirtyClass = "blocking" | "non_blocking" | "review";
export type WorktreeRecommendation = "continue" | "review" | "stop";

export interface WorktreeStatusFile {
  path: string;
  status: string;
  classification: DirtyClass;
  reason: string;
}

export interface WorktreeStatusPayload {
  ok: true;
  version: 1;
  repoRoot: string;
  task: Record<string, unknown> | null;
  summary: {
    blocking: number;
    review: number;
    non_blocking: number;
    total: number;
    clean: boolean;
    taskInference: "explicit" | "single_active_claimed" | "ambiguous";
  };
  files: WorktreeStatusFile[];
  recommendation: WorktreeRecommendation;
}

interface GitStatusEntry {
  path: string;
  status: string;
}

export async function getWorktreeStatusPayload(input: {
  repoRoot: string;
  tasks: Task[];
  taskId: string | null;
}): Promise<WorktreeStatusPayload> {
  const selection = selectTask(input.tasks, input.taskId);
  const gitEntries = await readGitStatus(input.repoRoot);

  if (!selection.task) {
    return toPayload(input.repoRoot, null, "ambiguous", "review", gitEntries.map((entry) => ({
      ...entry,
      classification: "review",
      reason: selection.reason,
    })));
  }

  const files = gitEntries.map((entry) =>
    classifyGitStatusEntry(input.repoRoot, input.tasks, selection.task!, entry),
  );
  return toPayload(input.repoRoot, selection.task, selection.inference, recommend(files), files);
}

function selectTask(tasks: Task[], taskId: string | null):
  | { task: Task; inference: "explicit" | "single_active_claimed" }
  | { task: null; reason: string } {
  if (taskId) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    return task ? { task, inference: "explicit" } : { task: null, reason: "task_not_found" };
  }

  const claimedTasks = tasks.filter((task) => {
    return task.claimed_by && task.status !== "done" && task.status !== "canceled";
  });
  if (claimedTasks.length === 1) {
    return { task: claimedTasks[0], inference: "single_active_claimed" };
  }
  return { task: null, reason: "task_inference_ambiguous" };
}

async function readGitStatus(repoRoot: string): Promise<GitStatusEntry[]> {
  const proc = Bun.spawn(["git", "-C", repoRoot, "status", "--porcelain=v1", "-z"], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "git status failed");
  }
  return parsePorcelainStatus(stdout);
}

function parsePorcelainStatus(output: string): GitStatusEntry[] {
  const parts = output.split("\0").filter(Boolean);
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const raw = parts[index];
    const status = raw.slice(0, 2);
    const filePath = raw.slice(3);
    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
    entries.push({ path: normalizePath(filePath), status });
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
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

function recommend(files: WorktreeStatusFile[]): WorktreeRecommendation {
  if (files.some((file) => file.classification === "blocking")) {
    return "stop";
  }
  if (files.some((file) => file.classification === "review")) {
    return "review";
  }
  return "continue";
}

function toPayload(
  repoRoot: string,
  task: Task | null,
  taskInference: WorktreeStatusPayload["summary"]["taskInference"],
  recommendation: WorktreeRecommendation,
  files: WorktreeStatusFile[],
): WorktreeStatusPayload {
  return {
    ok: true,
    version: 1,
    repoRoot,
    task: task ? toRobotTaskSummary(task) : null,
    summary: {
      blocking: countClass(files, "blocking"),
      review: countClass(files, "review"),
      non_blocking: countClass(files, "non_blocking"),
      total: files.length,
      clean: files.length === 0,
      taskInference,
    },
    files,
    recommendation,
  };
}

function countClass(files: WorktreeStatusFile[], classification: DirtyClass) {
  return files.filter((file) => file.classification === classification).length;
}

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}
