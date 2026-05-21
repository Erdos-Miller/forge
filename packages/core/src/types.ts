export type TaskKind = "task" | "spec";
export type TaskStatus = "open" | "doing" | "blocked" | "done" | "canceled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskAvailability = "ready" | "active" | "claimed" | "blocked" | "closed";

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  project?: string;
  area?: string;
  parent: string;
  depends_on: string[];
  claimed_by: string;
  scope: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
  blocked_reason?: string;
  review_reason?: string;
  body: string;
  sourcePath: string;
}

export interface ParsedTask {
  task: Task;
  frontmatter: Record<string, unknown>;
}

export type TaskFrontmatterUpdates = Partial<
  Pick<
    Task,
    | "status"
    | "priority"
    | "project"
    | "area"
    | "depends_on"
    | "claimed_by"
    | "scope"
    | "updated_at"
    | "closed_at"
    | "close_reason"
    | "blocked_reason"
    | "review_reason"
  >
>;

export interface CreateTaskInput {
  id: string;
  title: string;
  priority?: TaskPriority;
  project?: string;
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

export interface DependencyEditResult {
  task: Task;
  changed: boolean;
  reason: "added" | "already_present" | "removed" | "absent";
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
  availabilityByTaskId: Map<string, TaskAvailability>;
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
