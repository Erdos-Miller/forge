import type { Task } from "@forge/core";

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

export function taskMatchesScope(task: Task, scopeFilter: string) {
  return scopeFilter === "all" || inferTaskScopeLabels(task).includes(scopeFilter);
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
