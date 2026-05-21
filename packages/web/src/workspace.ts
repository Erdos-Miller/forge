import type { Task, TaskAvailability } from "@forge/core";
import type { TaskGraphPayload, WorkspaceRootPayload, WorkspaceTaskGraphPayload } from "./api";

export type AppData = TaskGraphPayload | WorkspaceTaskGraphPayload;
export type QueueTask = Task & {
  originalTaskId?: string;
  workspaceRootId?: string;
  workspaceRootName?: string;
};

export interface WorkspaceGraph {
  id: string;
  displayName: string;
  path: string;
  graph: TaskGraphPayload;
}

export function getWorkspaceGraphs(data: AppData): WorkspaceGraph[] {
  if (!("workspace" in data)) {
    return [
      {
        id: ".",
        displayName: getRepoDisplayName(data.repoRoot),
        path: data.repoRoot,
        graph: data,
      },
    ];
  }

  return data.workspace.roots
    .filter((root): root is WorkspaceRootPayload & { graph: TaskGraphPayload } => {
      return root.status === "ok" && Boolean(root.graph);
    })
    .map((root) => ({
      id: root.id,
      displayName: root.displayName,
      path: root.path,
      graph: root.graph,
    }));
}

export function resolveSelectedRepoId(data: AppData, selectedRepoId: string): string {
  const roots = getWorkspaceGraphs(data);
  if (selectedRepoId === "all" && roots.length > 1) {
    return "all";
  }
  if (roots.some((root) => root.id === selectedRepoId)) {
    return selectedRepoId;
  }
  return roots.length > 1 ? "all" : (roots[0]?.id ?? "all");
}

export function getGraphForRepo(data: AppData, repoId: string): TaskGraphPayload {
  const roots = getWorkspaceGraphs(data);
  if (repoId === "all" && roots.length > 1) {
    return buildAggregateGraph(data, roots);
  }
  return roots.find((root) => root.id === repoId)?.graph ?? data;
}

export function getFooterRepoLabel(
  currentData: TaskGraphPayload,
  repoId: string,
  roots: WorkspaceGraph[],
) {
  if (repoId === "all" && roots.length > 1) {
    return `${roots.length} repos under ${currentData.repoRoot}`;
  }
  return currentData.repoRoot;
}

function buildAggregateGraph(data: AppData, roots: WorkspaceGraph[]): TaskGraphPayload {
  const tasks = roots.flatMap((root) => {
    return root.graph.tasks.map((task) => decorateTaskForRoot(root, task));
  });
  const availabilityByTaskId = Object.fromEntries(
    roots.flatMap((root) =>
      Object.entries(root.graph.availabilityByTaskId).map(([taskId, availability]) => [
        scopedTaskId(root.id, taskId),
        availability,
      ]),
    ),
  );
  const blockersByTaskId = Object.fromEntries(
    roots.flatMap((root) =>
      Object.entries(root.graph.blockersByTaskId).map(([taskId, blockers]) => [
        scopedTaskId(root.id, taskId),
        blockers,
      ]),
    ),
  );

  return {
    repoRoot: "workspace" in data ? data.workspace.startDir : data.repoRoot,
    tasks,
    readyTaskIds: getAggregateRecommendedTaskIds(tasks, availabilityByTaskId),
    recommendedTaskIds: getAggregateRecommendedTaskIds(tasks, availabilityByTaskId),
    availabilityByTaskId,
    blockersByTaskId,
    diagnostics: {
      missingDependencies: roots.flatMap((root) => root.graph.diagnostics.missingDependencies),
      dependencyCycles: roots.flatMap((root) => root.graph.diagnostics.dependencyCycles),
      duplicateTaskIds: roots.flatMap((root) => root.graph.diagnostics.duplicateTaskIds),
    },
  };
}

function decorateTaskForRoot(root: WorkspaceGraph, task: Task): QueueTask {
  return {
    ...task,
    id: scopedTaskId(root.id, task.id),
    depends_on: task.depends_on.map((dependencyId) => scopedTaskId(root.id, dependencyId)),
    originalTaskId: task.id,
    workspaceRootId: root.id,
    workspaceRootName: root.displayName,
  };
}

function scopedTaskId(rootId: string, taskId: string) {
  return `${rootId}::${taskId}`;
}

function getAggregateRecommendedTaskIds(
  tasks: QueueTask[],
  availabilityByTaskId: Record<string, TaskAvailability>,
) {
  return tasks
    .filter((task) => availabilityByTaskId[task.id] === "ready")
    .sort((left, right) => {
      const priority = priorityRank(left.priority) - priorityRank(right.priority);
      return priority || left.title.localeCompare(right.title);
    })
    .map((task) => task.id);
}

function priorityRank(priority: Task["priority"]) {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[priority];
}

function getRepoDisplayName(repoRoot: string) {
  return repoRoot.split("/").filter(Boolean).at(-1) ?? repoRoot;
}
