import type { Task } from "@forge/core";
import type { ResolvedScopeConfigPayload, ScopeFilterPayload } from "./api";
import type { QueueTask } from "./workspace";

export const OTHER_SCOPE = "Other";

export function getInferredScopeOptions(tasks: Task[]): string[] {
  const scopes = new Set<string>();
  for (const task of tasks) {
    for (const scope of inferTaskScopeLabels(task)) {
      scopes.add(scope);
    }
  }
  return sortScopeLabels(Array.from(scopes));
}

export function taskMatchesScope(
  task: Task | QueueTask,
  scopeFilter: string,
  scopeConfig?: ResolvedScopeConfigPayload,
) {
  if (scopeFilter === "all") {
    return true;
  }
  const configuredProject = getConfiguredProjects(scopeConfig).find(
    (project) => project.id === scopeFilter,
  );
  if (configuredProject && !taskMatchesProjectRoot(task, configuredProject)) {
    return false;
  }
  return task.project === scopeFilter;
}

export function getProjectOptions(
  tasks: Array<Task | QueueTask>,
  scopeConfig?: ResolvedScopeConfigPayload,
): ScopeFilterPayload[] {
  const configuredProjects = getConfiguredProjects(scopeConfig);
  const optionsById = new Map(configuredProjects.map((project) => [project.id, project]));
  const unknownProjectIds = Array.from(
    new Set(
      tasks
        .map((task) => task.project)
        .filter((project): project is string => Boolean(project) && !optionsById.has(project)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  for (const projectId of unknownProjectIds) {
    optionsById.set(projectId, { id: projectId, label: projectId, paths: [] });
  }

  return [...configuredProjects, ...unknownProjectIds.map((projectId) => optionsById.get(projectId)!)];
}

export function inferTaskScopeLabels(task: Pick<Task, "scope">): string[] {
  const labels = task.scope.map(inferScopeLabel);
  return Array.from(new Set(labels));
}

export function inferScopeLabel(scope: string): string {
  const pathParts = normalizeScopeParts(scope);
  if (pathParts.length === 0) {
    return OTHER_SCOPE;
  }

  if (pathParts.length === 1) {
    return isFileLike(pathParts[0]) ? OTHER_SCOPE : pathParts[0];
  }

  const [first, second, third] = pathParts;
  if (first === "packages" && second) {
    return joinScopeParts(first, second);
  }
  if (first === "apps" && second) {
    return joinScopeParts(first, second);
  }
  if (first === "lib" && second && third) {
    return joinScopeParts(first, second, third);
  }
  if (first === "product" && second) {
    return joinScopeParts(first, second);
  }
  if (first.startsWith(".")) {
    return first;
  }
  if (["docs", "scripts", "src", "test", "tests"].includes(first)) {
    return first;
  }

  return OTHER_SCOPE;
}

function normalizeScopeParts(scope: string): string[] {
  return scope
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "**")
    .filter((part) => !part.includes("*"))
    .filter((part) => !isFileLike(part));
}

function sortScopeLabels(scopes: string[]) {
  return scopes.sort((left, right) => {
    if (left === OTHER_SCOPE) {
      return 1;
    }
    if (right === OTHER_SCOPE) {
      return -1;
    }
    return left.localeCompare(right);
  });
}

function joinScopeParts(...parts: string[]) {
  return parts.join("/");
}

function isFileLike(part: string) {
  return /^[^.].*\.[a-z0-9]+$/i.test(part);
}

function taskMatchesProjectRoot(
  task: Task | QueueTask,
  configuredProject: ResolvedScopeConfigPayload["scopes"][number],
) {
  if (configuredProject.rootId && "workspaceRootId" in task) {
    if (task.workspaceRootId !== configuredProject.rootId) {
      return false;
    }
  }
  return true;
}

function getConfiguredProjects(
  scopeConfig: ResolvedScopeConfigPayload | undefined,
): ResolvedScopeConfigPayload["scopes"] {
  if (scopeConfig?.source !== "configured") {
    return [];
  }
  return scopeConfig?.projects ?? scopeConfig?.scopes ?? [];
}

function scopePathsOverlap(left: string, right: string): boolean {
  const leftPrefix = getScopePathPrefix(left);
  const rightPrefix = getScopePathPrefix(right);
  return isSameOrChildPath(leftPrefix, rightPrefix) || isSameOrChildPath(rightPrefix, leftPrefix);
}

function getScopePathPrefix(scopePath: string): string {
  return scopePath
    .replace(/\\/g, "/")
    .replace(/\/?\*\*.*$/, "")
    .replace(/\/?\*.*$/, "")
    .replace(/\/+$/, "");
}

function isSameOrChildPath(parent: string, child: string): boolean {
  return parent === child || Boolean(parent && child.startsWith(`${parent}/`));
}
