import type { Task, TaskAvailability } from "@forge/core";
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsView } from "./AnalyticsView";
import type { TaskCoordinationPayload, TaskGraphPayload } from "./api";
import { shouldShowDoneInQueue } from "./queue-visibility";
import { getInferredScopeOptions, taskMatchesScope } from "./scopes";
import { organizeTaskMarkdown, type MarkdownSection } from "./sections";
import "./styles.css";
import {
  getVisibleSelectedTask,
  readInitialRepoSearchParam,
  readInitialTaskSearchParam,
  writeTaskSelectionToUrl,
} from "./url-selection";
import {
  getFooterRepoLabel,
  getGraphForRepo,
  getWorkspaceGraphs,
  resolveSelectedRepoId,
  type AppData,
  type QueueTask,
} from "./workspace";

interface AppProps {
  initialData?: AppData;
}

export function App({ initialData }: AppProps) {
  const initialUrlTaskId = readInitialTaskSearchParam();
  const initialUrlRepoId = readInitialRepoSearchParam();
  const [urlRequestedTaskId, setUrlRequestedTaskId] = useState<string | null>(initialUrlTaskId);
  const [data, setData] = useState<AppData | null>(initialData ?? null);
  const [selectedRepoId, setSelectedRepoId] = useState<string>(initialUrlRepoId ?? "all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialUrlTaskId ?? null,
  );
  const [activeTab, setActiveTab] = useState<"queue" | "analytics">("queue");
  const [groupBy, setGroupBy] = useState<"area" | "priority">("area");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(() => {
    fetch("/api/tasks")
      .then(async (response) => {
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          const message =
            typeof errorPayload?.error === "string"
              ? errorPayload.error
              : `request failed: ${response.status}`;
          throw new Error(message);
        }
        return response.json() as Promise<AppData>;
      })
      .then((payload) => {
        setData(payload);
        setError(null);
        setSelectedTaskId(
          (current) => {
            const repoId = resolveSelectedRepoId(payload, selectedRepoId);
            return selectTaskAfterRefresh(
              current,
              getGraphForRepo(payload, repoId),
              scopeFilter,
              showDone,
              urlRequestedTaskId,
            );
          },
        );
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      });
  }, [scopeFilter, selectedRepoId, showDone, urlRequestedTaskId]);

  useEffect(() => {
    if (initialData) {
      return;
    }

    loadTasks();
  }, [initialData, loadTasks]);

  useEffect(() => {
    if (initialData || !import.meta.hot) {
      return;
    }

    const reloadTasks = () => {
      loadTasks();
    };
    import.meta.hot.on("forge:tasks-changed", reloadTasks);
    return () => {
      import.meta.hot?.off("forge:tasks-changed", reloadTasks);
    };
  }, [initialData, loadTasks]);

  const workspaceGraphs = useMemo(() => {
    return data ? getWorkspaceGraphs(data) : [];
  }, [data]);

  const resolvedRepoId = useMemo(() => {
    return data ? resolveSelectedRepoId(data, selectedRepoId) : "all";
  }, [data, selectedRepoId]);

  const currentData = useMemo(() => {
    return data ? getGraphForRepo(data, resolvedRepoId) : null;
  }, [data, resolvedRepoId]);

  const tasksById = useMemo(() => {
    return new Map((currentData?.tasks ?? []).map((task) => [task.id, task]));
  }, [currentData]);

  const scopeOptions = useMemo(() => {
    if (currentData?.scopeConfig.source === "configured") {
      return currentData.scopeConfig.scopes;
    }
    return getInferredScopeOptions(currentData?.tasks ?? []).map((scope) => ({
      id: scope,
      label: scope,
      paths: [],
    }));
  }, [currentData]);

  const recommendedTasks = useMemo(() => {
    if (!currentData) {
      return [];
    }
    return currentData.recommendedTaskIds
      .map((taskId) => tasksById.get(taskId))
      .filter((task): task is Task => Boolean(task))
      .filter((task) => taskMatchesScope(task, scopeFilter, currentData.scopeConfig));
  }, [currentData, scopeFilter, tasksById]);

  const scopedTasks = useMemo(() => {
    return (currentData?.tasks ?? []).filter((task) =>
      taskMatchesScope(task, scopeFilter, currentData?.scopeConfig),
    );
  }, [currentData, scopeFilter]);

  const blockedOpenTasks = useMemo(() => {
    return scopedTasks.filter((task) => {
      const blockers = currentData?.blockersByTaskId[task.id] ?? [];
      return task.status === "open" && blockers.length > 0;
    });
  }, [currentData, scopedTasks]);

  const blockedTasks = useMemo(() => {
    return blockedOpenTasks.slice(0, 6);
  }, [blockedOpenTasks]);

  const doneTasks = useMemo(() => {
    return scopedTasks.filter((task) => task.status === "done" || task.status === "canceled");
  }, [scopedTasks]);

  const effectiveShowDone = useMemo(() => {
    return shouldShowDoneInQueue(scopedTasks, showDone);
  }, [scopedTasks, showDone]);

  const recentDoneTasks = useMemo(() => {
    return doneTasks.slice(-4).reverse();
  }, [doneTasks]);

  const recommendedRank = useMemo(() => {
    return new Map((currentData?.recommendedTaskIds ?? []).map((taskId, index) => [taskId, index]));
  }, [currentData]);

  const queueTasks = useMemo(() => {
    return sortQueueTasks(scopedTasks, recommendedRank, effectiveShowDone);
  }, [effectiveShowDone, recommendedRank, scopedTasks]);

  const groupedQueueTasks = useMemo(() => {
    return groupQueueTasks(queueTasks, groupBy, currentData?.availabilityByTaskId ?? {});
  }, [currentData, groupBy, queueTasks]);

  const visibleQueueTasks = useMemo(() => {
    return groupedQueueTasks.flatMap(([, sections]) =>
      sections.flatMap((section) => section.tasks),
    );
  }, [groupedQueueTasks]);

  const diagnosticMessages = useMemo(() => {
    return currentData ? getDiagnosticMessages(currentData.diagnostics) : [];
  }, [currentData]);

  const selectedTask = getVisibleSelectedTask(
    selectedTaskId,
    visibleQueueTasks,
    urlRequestedTaskId,
  );
  const selectedVisibleTaskId = selectedTask?.id ?? null;
  const queueRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectVisibleTask = useCallback((taskId: string) => {
    setUrlRequestedTaskId(null);
    setSelectedTaskId(taskId);
    writeTaskSelectionToUrl(taskId, resolvedRepoId);
  }, [resolvedRepoId]);

  const selectRepo = useCallback((repoId: string) => {
    const nextGraph = data ? getGraphForRepo(data, repoId) : null;
    const nextTaskId = nextGraph
      ? selectTaskAfterRefresh(null, nextGraph, scopeFilter, showDone)
      : null;
    setSelectedRepoId(repoId);
    setUrlRequestedTaskId(null);
    setSelectedTaskId(nextTaskId);
    if (nextTaskId) {
      writeTaskSelectionToUrl(nextTaskId, repoId);
    }
  }, [data, scopeFilter, showDone]);

  const setQueueRowRef = useCallback((taskId: string, element: HTMLButtonElement | null) => {
    if (element) {
      queueRowRefs.current.set(taskId, element);
    } else {
      queueRowRefs.current.delete(taskId);
    }
  }, []);

  useEffect(() => {
    const selectedRow = selectedVisibleTaskId
      ? queueRowRefs.current.get(selectedVisibleTaskId)
      : null;
    selectedRow?.scrollIntoView({ block: "nearest" });
  }, [selectedVisibleTaskId, visibleQueueTasks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreQueueShortcutTarget(event.target)) {
        return;
      }

      const nextSelection = getKeyboardQueueSelection(
        visibleQueueTasks,
        selectedVisibleTaskId,
        event.key,
      );
      if (!nextSelection.handled) {
        return;
      }

      event.preventDefault();
      if (nextSelection.taskId) {
        selectVisibleTask(nextSelection.taskId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectVisibleTask, selectedVisibleTaskId, visibleQueueTasks]);

  if (!data) {
    return (
      <main className={`shell ${error ? "error" : "muted"}`}>
        {error ? `Failed to load tasks: ${error}` : "Loading Forge tasks..."}
      </main>
    );
  }
  if (!currentData) {
    return <main className="shell muted">No Forge roots found.</main>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandBlock">
          <h1>Forge</h1>
        </div>
        <div className="headerControls">
          {workspaceGraphs.length > 1 ? (
            <label className="headerControl">
              <span>Worktree</span>
              <select value={resolvedRepoId} onChange={(event) => selectRepo(event.target.value)}>
                <option value="all">All repos</option>
                {workspaceGraphs.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="headerControl">
            <span>Scope</span>
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
              <option value="all">All</option>
              {scopeOptions.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="topNav" aria-label="Forge views">
          <button
            className={activeTab === "queue" ? "active" : ""}
            type="button"
            onClick={() => setActiveTab("queue")}
          >
            Queue
          </button>
          <button
            className={activeTab === "analytics" ? "active" : ""}
            type="button"
            onClick={() => setActiveTab("analytics")}
          >
            Analytics
          </button>
        </nav>
      </header>

      {error ? (
        <section className="errorBanner">
          <strong>Refresh failed</strong>
          <span>{error}</span>
        </section>
      ) : null}

      {diagnosticMessages.length > 0 ? (
        <section className="errorBanner">
          <strong>Task diagnostics</strong>
          <ul>
            {diagnosticMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeTab === "queue" ? (
        <section className="layout">
          <section className="queuePanel" aria-label="Task queue">
            <header className="panelHeader">
              <div>
                <h2>Queue</h2>
                <p>Unfinished work, with ready tasks ranked first.</p>
              </div>
              <div className="panelControls">
                <label className="showDoneToggle">
                  <input
                    checked={effectiveShowDone} disabled={effectiveShowDone && !showDone}
                    onChange={(event) => setShowDone(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Show done</span>
                </label>
                <div className="groupToggle" aria-label="Group queue by">
                  <button
                    className={groupBy === "area" ? "active" : ""}
                    type="button"
                    onClick={() => setGroupBy("area")}
                  >
                    Area
                  </button>
                  <button
                    className={groupBy === "priority" ? "active" : ""}
                    type="button"
                    onClick={() => setGroupBy("priority")}
                  >
                    Priority
                  </button>
                </div>
              </div>
            </header>

            <div className="queueGroups">
              {groupedQueueTasks.length > 0 ? (
                groupedQueueTasks.map(([group, sections]) => (
                  <section className="areaGroup" key={group}>
                    <header className="areaHeader">
                      <h3>{group}</h3>
                      <span>
                        {sections.reduce((count, section) => count + section.tasks.length, 0)} tasks
                      </span>
                    </header>
                    {sections.map((section) => (
                      <section className="availabilitySection" key={section.availability}>
                        <header>
                          <h4>{section.label}</h4>
                          <span>{section.tasks.length}</span>
                        </header>
                        <div className="taskRows">
                          {section.tasks.map((task) => (
                            <QueueRow
                              availability={currentData.availabilityByTaskId[task.id] ?? "blocked"}
                              blockers={currentData.blockersByTaskId[task.id] ?? []}
                              groupBy={groupBy}
                              isSelected={selectedTask?.id === task.id}
                              key={task.id}
                              onSelect={() => selectVisibleTask(task.id)}
                              rank={
                                section.availability === "ready"
                                  ? queueTasks.indexOf(task) + 1
                                  : undefined
                              }
                              recommendedRank={recommendedRank.get(task.id)}
                              rowRef={(element) => setQueueRowRef(task.id, element)}
                              blockerCount={currentData.blockersByTaskId[task.id]?.length ?? 0}
                              task={task}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </section>
                ))
              ) : (
                <p className="empty">No tasks match this filter.</p>
              )}
            </div>

            <aside className="queueFooter">
              <SummaryList title="Blocked open tasks" tasks={blockedTasks} />
              <SummaryList title="Recent done" tasks={recentDoneTasks} />
            </aside>
          </section>

          <TaskDetail
            blockers={selectedTask ? currentData.blockersByTaskId[selectedTask.id] ?? [] : []}
            coordination={
              selectedTask ? currentData.coordinationByTaskId[selectedTask.id] : undefined
            }
            isRecommended={
              selectedTask ? currentData.recommendedTaskIds.includes(selectedTask.id) : false
            }
            task={selectedTask}
            tasksById={tasksById}
          />
        </section>
      ) : (
        <AnalyticsView doneTasks={doneTasks} scopedTasks={scopedTasks} />
      )}

      <footer className="appFooter">
        <span>{getFooterRepoLabel(currentData, resolvedRepoId, workspaceGraphs)}</span>
        <span>
          {recommendedTasks.length} ready / {blockedOpenTasks.length} blocked /{" "}
          {doneTasks.length} done / {scopedTasks.length} total
        </span>
      </footer>
    </main>
  );
}

function QueueRow({
  task,
  blockers,
  availability,
  groupBy,
  isSelected,
  rank,
  recommendedRank,
  blockerCount,
  rowRef,
  onSelect,
}: {
  task: QueueTask;
  blockers: string[];
  availability: TaskAvailability;
  groupBy: "area" | "priority";
  isSelected: boolean;
  rank?: number;
  recommendedRank?: number;
  blockerCount: number;
  rowRef: (element: HTMLButtonElement | null) => void;
  onSelect: () => void;
}) {
  const state = getQueueRowState(task, blockers, availability, recommendedRank);
  const badge = getQueueRowBadge(task, availability, blockerCount);

  return (
    <button
      className={`queueRow ${state} ${isSelected ? "selected" : ""}`}
      type="button"
      aria-current={isSelected ? "true" : undefined}
      onClick={onSelect}
      ref={rowRef}
    >
      <span className={`rank ${rank === undefined ? "mutedRank" : ""}`}>{rank ?? "-"}</span>
      <span className="queueText">
        <span className="titleLine">
          <PriorityDot priority={task.priority} />
          <span className="title">{task.title}</span>
        </span>
        <span className="rowBadges">
          {task.workspaceRootName ? <span className="badge">{task.workspaceRootName}</span> : null}
          {groupBy === "priority" && task.area ? <span className="badge">{task.area}</span> : null}
          {badge ? <span className="badge">{badge}</span> : null}
        </span>
      </span>
    </button>
  );
}

function SummaryList({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <section>
      <h3>{title}</h3>
      {tasks.length > 0 ? (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <span>{task.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">None.</p>
      )}
    </section>
  );
}

function TaskDetail({
  task,
  blockers,
  coordination,
  isRecommended,
  tasksById,
}: {
  task: QueueTask | null;
  blockers: string[];
  coordination?: TaskCoordinationPayload;
  isRecommended: boolean;
  tasksById: Map<string, Task>;
}) {
  if (!task) {
    return (
      <aside className="detail muted">
        No queue row is visible for this filter.
      </aside>
    );
  }

  const sections = organizeTaskMarkdown(task.body);
  const readiness = isRecommended
    ? "Recommended now by Forge ranking."
    : blockers.length
      ? blockers.join("; ")
      : `Status is ${task.status}.`;
  const detailMeta = [
    task.workspaceRootName ? `repo ${task.workspaceRootName}` : null,
    task.area ? `area ${task.area}` : null,
    task.scope.length ? task.scope.join(", ") : null,
    task.claimed_by ? `claimed by ${task.claimed_by}` : null,
  ].filter(Boolean);

  return (
    <aside className="detail">
      <header className="detailHeader">
        <div className="detailKicker">
          <PriorityDot priority={task.priority} />
          <span className="statusText">{task.status}</span>
          <span>{task.originalTaskId ?? task.id}</span>
        </div>
        <div className="detailTitleLine">
          <h2>{task.title}</h2>
        </div>
        <p className="readiness">{readiness}</p>
      </header>

      {blockers.length > 0 ? (
        <section className="blockers">
          <h3>Blockers</h3>
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <CoordinationWarning coordination={coordination} />

      <div className="taskSections">
        <TaskSection section={sections.why} title="Why" variant="lead" />
        <TaskSection section={sections.success} title="What success looks like" />
        <TaskSection section={sections.acceptance} title="Acceptance Criteria" variant="list" />
        {sections.notes.map((section) => (
          <TaskSection key={section.index} section={section} title={section.title} />
        ))}
        <CollapsedTaskSection section={sections.verification} title="Verification" />
        <div className="supportingSections">
          <TaskSection section={sections.executionPlan} title="Execution Plan" />
          <DependencyDetails
            dependencySection={sections.dependencies}
            dependsOn={task.depends_on}
            tasksById={tasksById}
          />
          <SectionDetails title="Implementation Notes" sections={sections.implementationNotes} />
          <SectionDetails title="History" sections={sections.history} />
          <SectionDetails title="Additional Details" sections={sections.additional} />
        </div>
        {sections.fallbackBody ? (
          <section
            className="markdown taskSection"
            dangerouslySetInnerHTML={{
              __html: marked.parse(sections.fallbackBody, { async: false }) as string,
            }}
          />
        ) : null}
        <footer className="detailFooter">
          {detailMeta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </footer>
      </div>
    </aside>
  );
}

function CoordinationWarning({
  coordination,
}: {
  coordination: TaskCoordinationPayload | undefined;
}) {
  if (!coordination || coordination.summary.blocking + coordination.summary.review === 0) {
    return null;
  }

  const relevantFiles = coordination.files.filter((file) => {
    return file.classification === "blocking" || file.classification === "review";
  });

  return (
    <section className="coordinationWarning">
      <h3>Worktree coordination</h3>
      <p>{getCoordinationMessage(coordination)}</p>
      <details>
        <summary>{relevantFiles.length} file{relevantFiles.length === 1 ? "" : "s"}</summary>
        <ul>
          {relevantFiles.map((file) => (
            <li key={`${file.path}:${file.classification}`}>
              <span>{file.path}</span>
              <small>{file.classification.replace("_", " ")}</small>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function getCoordinationMessage(coordination: TaskCoordinationPayload) {
  const parts = [
    coordination.summary.blocking ? `${coordination.summary.blocking} blocking` : null,
    coordination.summary.review ? `${coordination.summary.review} review` : null,
  ].filter(Boolean);
  const action =
    coordination.recommendation === "stop"
      ? "Stop before continuing."
      : "Review before closing.";
  return `${parts.join(" / ")} worktree item${parts.length === 1 ? "" : "s"}. ${action}`;
}

function DependencyDetails({
  dependencySection,
  dependsOn,
  tasksById,
}: {
  dependencySection: MarkdownSection | undefined;
  dependsOn: string[];
  tasksById: Map<string, Task>;
}) {
  if (!dependencySection && dependsOn.length === 0) {
    return null;
  }

  const title = dependsOn.length > 0 ? `Dependencies (${dependsOn.length})` : "Dependencies";

  return (
    <details className="sectionDetails dependencyDetails">
      <summary>{title}</summary>
      {dependsOn.length > 0 ? (
        <section className="dependencies">
          <ul>
            {dependsOn.map((dependencyId) => {
              const dependency = tasksById.get(dependencyId);
              return (
                <li key={dependencyId}>
                  <span>{dependency?.title ?? dependencyId}</span>
                  {dependency ? <small>{dependency.status}</small> : <small>missing</small>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <TaskSection section={dependencySection} title={dependencySection?.title ?? "Dependencies"} />
    </details>
  );
}

function CollapsedTaskSection({
  section,
  title,
}: {
  section: MarkdownSection | undefined;
  title: string;
}) {
  if (!section) {
    return null;
  }

  return (
    <details className="sectionDetails collapsedMarkdown">
      <summary>{title}</summary>
      <div
        className="markdown collapsedSectionBody"
        dangerouslySetInnerHTML={{
          __html: marked.parse(section.body, { async: false }) as string,
        }}
      />
    </details>
  );
}

function TaskSection({
  section,
  title,
  variant = "normal",
}: {
  section: MarkdownSection | undefined;
  title: string;
  variant?: "normal" | "lead" | "success" | "list" | "verify";
}) {
  if (!section) {
    return null;
  }

  return (
    <section className={`markdown taskSection ${variant}`}>
      <h3>{title}</h3>
      <div
        dangerouslySetInnerHTML={{
          __html: marked.parse(section.body, { async: false }) as string,
        }}
      />
    </section>
  );
}

function SectionDetails({ title, sections }: { title: string; sections: MarkdownSection[] }) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <details className="sectionDetails">
      <summary>{title}</summary>
      {sections.map((section) => (
        <TaskSection key={section.index} section={section} title={section.title} />
      ))}
    </details>
  );
}

export function selectTaskAfterRefresh(
  currentTaskId: string | null,
  payload: TaskGraphPayload,
  scopeFilter: string,
  showDone = false,
  urlRequestedTaskId: string | null = null,
): string | null {
  const scopedTasks = payload.tasks.filter((task) =>
    taskMatchesScope(task, scopeFilter, payload.scopeConfig),
  );
  const effectiveShowDone = shouldShowDoneInQueue(scopedTasks, showDone);
  const recommendedRank = new Map(
    payload.recommendedTaskIds.map((taskId, index) => [taskId, index]),
  );
  const visibleTasks = groupQueueTasks(
    sortQueueTasks(scopedTasks, recommendedRank, effectiveShowDone),
    "area",
    payload.availabilityByTaskId,
  ).flatMap(([, sections]) => sections.flatMap((section) => section.tasks));

  if (currentTaskId && visibleTasks.some((task) => task.id === currentTaskId)) {
    return currentTaskId;
  }
  if (currentTaskId && currentTaskId === urlRequestedTaskId) {
    return currentTaskId;
  }

  for (const taskId of payload.recommendedTaskIds) {
    if (visibleTasks.some((task) => task.id === taskId)) {
      return taskId;
    }
  }

  return visibleTasks[0]?.id ?? null;
}

export function getKeyboardQueueSelection(
  tasks: Array<Pick<Task, "id">>,
  currentTaskId: string | null,
  key: string,
): { handled: boolean; taskId: string | null } {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
    return { handled: false, taskId: currentTaskId };
  }
  if (tasks.length === 0) {
    return { handled: true, taskId: null };
  }

  const currentIndex = tasks.findIndex((task) => task.id === currentTaskId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = getKeyboardQueueIndex(safeIndex, tasks.length, key);
  return { handled: true, taskId: tasks[nextIndex].id };
}

function getKeyboardQueueIndex(currentIndex: number, taskCount: number, key: string) {
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return taskCount - 1;
  }
  if (key === "ArrowUp") {
    return Math.max(0, currentIndex - 1);
  }
  return Math.min(taskCount - 1, currentIndex + 1);
}

export function shouldIgnoreQueueShortcutTarget(target: EventTarget | null) {
  if (!target || !("tagName" in target)) {
    return false;
  }

  const tagName = String((target as { tagName?: unknown }).tagName).toLowerCase();
  if (["input", "select", "textarea", "button"].includes(tagName)) {
    return true;
  }

  if (typeof Element !== "undefined" && target instanceof Element) {
    return Boolean(
      target.closest("button, a, [role='button'], [contenteditable='true']"),
    );
  }

  return false;
}

export function sortQueueTasks(
  tasks: Task[],
  recommendedRank: Map<string, number>,
  showDone: boolean,
): Task[] {
  const taskPool = showDone
    ? tasks
    : tasks.filter((task) => task.status !== "done" && task.status !== "canceled");

  return [...taskPool].sort((left, right) => {
    const leftRank = recommendedRank.get(left.id) ?? Number.POSITIVE_INFINITY;
    const rightRank = recommendedRank.get(right.id) ?? Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const priority = priorityRank(left.priority) - priorityRank(right.priority);
    return priority || left.title.localeCompare(right.title);
  });
}

export function groupQueueTasks(
  tasks: Task[],
  groupBy: "area" | "priority",
  availabilityByTaskId: Record<string, TaskAvailability> = {},
): Array<[string, QueueAvailabilitySection[]]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const group = groupBy === "priority" ? task.priority : (task.area ?? "unassigned");
    groups.set(group, [...(groups.get(group) ?? []), task]);
  }

  const entries = Array.from(groups.entries()).map(([group, groupTasks]) => [
    group,
    sectionQueueTasks(groupTasks, availabilityByTaskId),
  ] as [string, QueueAvailabilitySection[]]);
  if (groupBy === "priority") {
    return entries.sort(
      ([left], [right]) =>
        priorityRank(left as Task["priority"]) - priorityRank(right as Task["priority"]),
    );
  }
  return entries;
}

interface QueueAvailabilitySection {
  availability: TaskAvailability;
  label: string;
  tasks: Task[];
}

const availabilitySectionOrder: Array<{ availability: TaskAvailability; label: string }> = [
  { availability: "ready", label: "Ready" },
  { availability: "active", label: "In progress" },
  { availability: "claimed", label: "Claimed" },
  { availability: "blocked", label: "Blocked" },
  { availability: "closed", label: "Done" },
];

function sectionQueueTasks(
  tasks: Task[],
  availabilityByTaskId: Record<string, TaskAvailability>,
): QueueAvailabilitySection[] {
  return availabilitySectionOrder
    .map(({ availability, label }) => ({
      availability,
      label,
      tasks: tasks.filter((task) => getTaskAvailability(task, availabilityByTaskId) === availability),
    }))
    .filter((section) => section.tasks.length > 0);
}

function getTaskAvailability(
  task: Task,
  availabilityByTaskId: Record<string, TaskAvailability>,
): TaskAvailability {
  if (task.status === "done" || task.status === "canceled") {
    return "closed";
  }
  if (task.status === "doing") {
    return "active";
  }
  if (task.claimed_by.trim() !== "") {
    return "claimed";
  }
  if (task.status === "blocked") {
    return "blocked";
  }
  return availabilityByTaskId[task.id] ?? "blocked";
}

function priorityRank(priority: Task["priority"]) {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[priority];
}

function getQueueRowState(
  task: Task,
  blockers: string[],
  availability: TaskAvailability,
  recommendedRank?: number,
) {
  if (task.status === "done" || task.status === "canceled") {
    return "done";
  }
  if (task.status === "doing") {
    return "active";
  }
  if (task.claimed_by.trim() !== "") {
    return "claimed";
  }
  if (availability === "blocked" || blockers.length > 0 || task.status === "blocked") {
    return "blocked";
  }
  return recommendedRank === undefined ? "open" : "ready";
}

function getQueueRowBadge(
  task: Task,
  availability: TaskAvailability,
  blockerCount: number,
) {
  if (task.status === "doing") {
    return "in progress";
  }
  if (task.claimed_by.trim() !== "") {
    return `claimed by ${task.claimed_by}`;
  }
  if (availability === "blocked" && blockerCount > 0) {
    return `blocked by ${blockerCount}`;
  }
  return null;
}

function PriorityDot({ priority }: { priority: Task["priority"] }) {
  return (
    <span
      aria-label={`${priority} priority`}
      className={`priorityDot ${priority}`}
      title={`${priority} priority`}
    />
  );
}

function getDiagnosticMessages(diagnostics: TaskGraphPayload["diagnostics"]) {
  return [
    ...diagnostics.missingDependencies.map(
      (diagnostic) => `${diagnostic.taskId} depends on missing task ${diagnostic.dependencyId}`,
    ),
    ...diagnostics.dependencyCycles.map(
      (diagnostic) => `Dependency cycle: ${diagnostic.taskIds.join(" -> ")}`,
    ),
    ...diagnostics.duplicateTaskIds.map(
      (diagnostic) =>
        `Duplicate task id ${diagnostic.taskId} in ${diagnostic.sourcePaths.length} files`,
    ),
  ];
}
