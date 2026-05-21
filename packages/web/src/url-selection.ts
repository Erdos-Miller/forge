import type { Task } from "@forge/core";

export function readInitialTaskSearchParam(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return getTaskIdFromSearch(window.location.search);
}

export function readInitialRepoSearchParam(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return getRepoIdFromSearch(window.location.search);
}

export function getTaskIdFromSearch(search: string): string | null {
  const taskId = new URLSearchParams(search).get("task")?.trim();
  return taskId || null;
}

export function getRepoIdFromSearch(search: string): string | null {
  const repoId = new URLSearchParams(search).get("repo")?.trim();
  return repoId || null;
}

export function writeTaskSelectionToUrl(taskId: string, repoId?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  const taskUnchanged = url.searchParams.get("task") === taskId;
  const repoUnchanged = repoId === undefined || url.searchParams.get("repo") === repoId;
  if (taskUnchanged && repoUnchanged) {
    return;
  }

  url.searchParams.set("task", taskId);
  if (repoId !== undefined) {
    url.searchParams.set("repo", repoId);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function getVisibleSelectedTask(
  selectedTaskId: string | null,
  visibleQueueTasks: Task[],
  urlRequestedTaskId: string | null = null,
): Task | null {
  const selectedTask = visibleQueueTasks.find((task) => task.id === selectedTaskId);
  if (selectedTask) {
    return selectedTask;
  }
  if (selectedTaskId && selectedTaskId === urlRequestedTaskId) {
    return null;
  }
  return visibleQueueTasks[0] ?? null;
}
