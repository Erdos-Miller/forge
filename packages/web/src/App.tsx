import type { Task, TaskAvailability } from "@forge/core";
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TaskGraphPayload } from "./api";
import { organizeTaskMarkdown, type MarkdownSection } from "./sections";
import "./styles.css";

interface AppProps {
  initialData?: TaskGraphPayload;
}

interface BurndownPoint {
  day: number;
  remaining: number;
}

interface BurndownData {
  points: BurndownPoint[];
  projectionPoints: BurndownPoint[];
  today: number;
  remaining: number;
  completionRate: number;
  projectedDate?: number;
  closedWithDates: number;
}

export function App({ initialData }: AppProps) {
  const [data, setData] = useState<TaskGraphPayload | null>(initialData ?? null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialData?.recommendedTaskIds[0] ?? initialData?.tasks[0]?.id ?? null,
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
        return response.json() as Promise<TaskGraphPayload>;
      })
      .then((payload) => {
        setData(payload);
        setError(null);
        setSelectedTaskId(
          (current) => selectTaskAfterRefresh(current, payload, scopeFilter),
        );
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      });
  }, [scopeFilter]);

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

  const tasksById = useMemo(() => {
    return new Map((data?.tasks ?? []).map((task) => [task.id, task]));
  }, [data]);

  const scopeOptions = useMemo(() => {
    const scopes = new Set<string>();
    for (const task of data?.tasks ?? []) {
      for (const scope of task.scope) {
        scopes.add(getScopeRoot(scope));
      }
    }
    return Array.from(scopes).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const recommendedTasks = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.recommendedTaskIds
      .map((taskId) => tasksById.get(taskId))
      .filter((task): task is Task => Boolean(task))
      .filter((task) => taskMatchesScope(task, scopeFilter));
  }, [data, scopeFilter, tasksById]);

  const scopedTasks = useMemo(() => {
    return (data?.tasks ?? []).filter((task) => taskMatchesScope(task, scopeFilter));
  }, [data, scopeFilter]);

  const blockedOpenTasks = useMemo(() => {
    return scopedTasks.filter((task) => {
      const blockers = data?.blockersByTaskId[task.id] ?? [];
      return task.status === "open" && blockers.length > 0;
    });
  }, [data, scopedTasks]);

  const blockedTasks = useMemo(() => {
    return blockedOpenTasks.slice(0, 6);
  }, [blockedOpenTasks]);

  const doneTasks = useMemo(() => {
    return scopedTasks.filter((task) => task.status === "done" || task.status === "canceled");
  }, [scopedTasks]);

  const recentDoneTasks = useMemo(() => {
    return doneTasks.slice(-4).reverse();
  }, [doneTasks]);

  const recommendedRank = useMemo(() => {
    return new Map((data?.recommendedTaskIds ?? []).map((taskId, index) => [taskId, index]));
  }, [data]);

  const queueTasks = useMemo(() => {
    return sortQueueTasks(scopedTasks, recommendedRank, showDone);
  }, [recommendedRank, scopedTasks, showDone]);

  const groupedQueueTasks = useMemo(() => {
    return groupQueueTasks(queueTasks, groupBy, data?.availabilityByTaskId ?? {});
  }, [data, groupBy, queueTasks]);

  const diagnosticMessages = useMemo(() => {
    return data ? getDiagnosticMessages(data.diagnostics) : [];
  }, [data]);

  const selectedCandidate = selectedTaskId ? (tasksById.get(selectedTaskId) ?? null) : null;
  const selectedTask =
    selectedCandidate && taskMatchesScope(selectedCandidate, scopeFilter)
      ? selectedCandidate
      : (queueTasks[0] ?? scopedTasks[0] ?? null);

  if (!data) {
    return (
      <main className={`shell ${error ? "error" : "muted"}`}>
        {error ? `Failed to load tasks: ${error}` : "Loading Forge tasks..."}
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandBlock">
          <h1>Forge</h1>
          <label className="scopeFilter">
            <span>Scope</span>
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
              <option value="all">All</option>
              {scopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
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
                    checked={showDone}
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
                              availability={data.availabilityByTaskId[task.id] ?? "blocked"}
                              blockers={data.blockersByTaskId[task.id] ?? []}
                              groupBy={groupBy}
                              isSelected={selectedTask?.id === task.id}
                              key={task.id}
                              onSelect={() => setSelectedTaskId(task.id)}
                              rank={
                                section.availability === "ready"
                                  ? queueTasks.indexOf(task) + 1
                                  : undefined
                              }
                              recommendedRank={recommendedRank.get(task.id)}
                              blockerCount={data.blockersByTaskId[task.id]?.length ?? 0}
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
            blockers={selectedTask ? data.blockersByTaskId[selectedTask.id] ?? [] : []}
            isRecommended={
              selectedTask ? data.recommendedTaskIds.includes(selectedTask.id) : false
            }
            task={selectedTask}
            tasksById={tasksById}
          />
        </section>
      ) : (
        <AnalyticsView doneTasks={doneTasks} scopedTasks={scopedTasks} />
      )}

      <footer className="appFooter">
        <span>{data.repoRoot}</span>
        <span>
          {recommendedTasks.length} ready / {blockedOpenTasks.length} blocked /{" "}
          {doneTasks.length} done / {scopedTasks.length} total
        </span>
      </footer>
    </main>
  );
}

function AnalyticsView({ doneTasks, scopedTasks }: { doneTasks: Task[]; scopedTasks: Task[] }) {
  const burndown = buildBurndown(scopedTasks);

  return (
    <section className="analyticsPanel">
      <header className="analyticsHeader">
        <h2>Analytics</h2>
        <p>Task history for the selected scope.</p>
      </header>
      <div className="analyticsGrid">
        <section className="burndownCard">
          <header>
            <div>
              <h3>Burndown</h3>
              <p>Calendar-day task count with recent-rate projection.</p>
            </div>
            <div className="analyticsStats">
              <Metric value={String(burndown.remaining)} label="remaining" />
              <Metric value={formatRate(burndown.completionRate)} label="rate" />
              <Metric
                value={burndown.projectedDate ? formatDateLabel(burndown.projectedDate) : "-"}
                label="projection"
              />
            </div>
          </header>
          <BurndownChart burndown={burndown} />
          <footer>
            <span>{scopedTasks.length} total</span>
            <span>{doneTasks.length} done</span>
            <span>{burndown.closedWithDates} with close dates</span>
          </footer>
        </section>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function BurndownChart({ burndown }: { burndown: BurndownData }) {
  const width = 420;
  const height = 180;
  const padding = { top: 12, right: 14, bottom: 30, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const allPoints = [...burndown.points, ...burndown.projectionPoints];
  const minDay = allPoints[0]?.day ?? burndown.today;
  const maxDay = allPoints.at(-1)?.day ?? burndown.today;
  const yMax = Math.max(1, ...allPoints.map((point) => point.remaining));

  const xFor = (day: number) =>
    padding.left + ((day - minDay) / Math.max(1, maxDay - minDay)) * chartWidth;
  const yFor = (remaining: number) =>
    padding.top + (1 - remaining / yMax) * chartHeight;
  const lineFor = (points: BurndownPoint[]) =>
    points.map((point) => `${xFor(point.day)},${yFor(point.remaining)}`).join(" ");
  const yTicks = [0, Math.round(yMax / 2), yMax];
  const xTicks = [
    burndown.points[0],
    burndown.points.at(-1),
    burndown.projectionPoints.at(-1),
  ].filter((point, index, points): point is BurndownPoint => {
    return Boolean(point) && points.findIndex((candidate) => candidate?.day === point.day) === index;
  });

  return (
    <div className="chartPanel">
      <svg aria-label="Task burndown chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="chartGrid"
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(tick)}
              y2={yFor(tick)}
            />
            <text className="chartTick" x={padding.left - 10} y={yFor(tick) + 4}>
              {tick}
            </text>
          </g>
        ))}
        <polyline className="chartLine" points={lineFor(burndown.points)} />
        {burndown.projectionPoints.length > 1 ? (
          <polyline className="projectionLine" points={lineFor(burndown.projectionPoints)} />
        ) : null}
        {xTicks.map((point) => (
          <text
            className="chartTick xTick"
            key={point.day}
            x={xFor(point.day)}
            y={height - 12}
          >
            {formatDateLabel(point.day)}
          </text>
        ))}
      </svg>
    </div>
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
  onSelect,
}: {
  task: Task;
  blockers: string[];
  availability: TaskAvailability;
  groupBy: "area" | "priority";
  isSelected: boolean;
  rank?: number;
  recommendedRank?: number;
  blockerCount: number;
  onSelect: () => void;
}) {
  const state = getQueueRowState(task, blockers, availability, recommendedRank);
  const badge = getQueueRowBadge(task, availability, blockerCount);

  return (
    <button
      className={`queueRow ${state} ${isSelected ? "selected" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span className={`rank ${rank === undefined ? "mutedRank" : ""}`}>{rank ?? "-"}</span>
      <span className="queueText">
        <span className="titleLine">
          <PriorityDot priority={task.priority} />
          <span className="title">{task.title}</span>
        </span>
        <span className="rowBadges">
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
  isRecommended,
  tasksById,
}: {
  task: Task | null;
  blockers: string[];
  isRecommended: boolean;
  tasksById: Map<string, Task>;
}) {
  if (!task) {
    return <aside className="detail muted">No task selected.</aside>;
  }

  const sections = organizeTaskMarkdown(task.body);
  const readiness = isRecommended
    ? "Recommended now by Forge ranking."
    : blockers.length
      ? blockers.join("; ")
      : `Status is ${task.status}.`;
  const detailMeta = [
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
          <span>{task.id}</span>
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

      <div className="taskSections">
        <TaskSection section={sections.why} title="Why" variant="lead" />
        <TaskSection section={sections.success} title="What success looks like" />
        <TaskSection section={sections.acceptance} title="Acceptance Criteria" variant="list" />
        {sections.notes.map((section) => (
          <TaskSection key={section.index} section={section} title={section.title} />
        ))}
        <CollapsedTaskSection section={sections.verification} title="Verification" />
        <DependencyDetails
          dependencySection={sections.dependencies}
          dependsOn={task.depends_on}
          tasksById={tasksById}
        />
        <SectionDetails title="Implementation Notes" sections={sections.implementationNotes} />
        <SectionDetails title="History" sections={sections.history} />
        <SectionDetails title="Additional Details" sections={sections.additional} />
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

function getScopeRoot(scope: string) {
  return scope.replace(/\/?\*\*.*$/, "").replace(/\/?\*.*$/, "").replace(/\/$/, "") || scope;
}

function taskMatchesScope(task: Task, scopeFilter: string) {
  return scopeFilter === "all" || task.scope.some((scope) => getScopeRoot(scope) === scopeFilter);
}

export function selectTaskAfterRefresh(
  currentTaskId: string | null,
  payload: TaskGraphPayload,
  scopeFilter: string,
): string | null {
  const scopedTasks = payload.tasks.filter((task) => taskMatchesScope(task, scopeFilter));
  if (currentTaskId && scopedTasks.some((task) => task.id === currentTaskId)) {
    return currentTaskId;
  }

  for (const taskId of payload.recommendedTaskIds) {
    if (scopedTasks.some((task) => task.id === taskId)) {
      return taskId;
    }
  }

  return scopedTasks[0]?.id ?? null;
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

const DAY_MS = 24 * 60 * 60 * 1000;

function buildBurndown(tasks: Task[]): BurndownData {
  const createdDays = tasks.map((task) => toUtcDay(task.created_at)).filter(isNumber);
  const closedDays = tasks.map((task) => toUtcDay(task.closed_at)).filter(isNumber);
  const today = toUtcDay(new Date().toISOString()) ?? Date.now();
  const firstDay = Math.min(...createdDays, ...closedDays, today);
  const lastHistoricalDay = Math.max(...createdDays, ...closedDays, today);
  const points: BurndownPoint[] = [];

  for (let day = firstDay; day <= lastHistoricalDay; day += DAY_MS) {
    const created = createdDays.filter((createdDay) => createdDay <= day).length;
    const closed = closedDays.filter((closedDay) => closedDay <= day).length;
    points.push({ day, remaining: Math.max(0, created - closed) });
  }

  const remaining =
    points.at(-1)?.remaining ??
    tasks.filter((task) => task.status !== "done" && task.status !== "canceled").length;
  const windowStart = Math.max(firstDay, lastHistoricalDay - 13 * DAY_MS);
  const windowDays = Math.max(1, Math.round((lastHistoricalDay - windowStart) / DAY_MS) + 1);
  const closedInWindow = closedDays.filter(
    (closedDay) => closedDay >= windowStart && closedDay <= lastHistoricalDay,
  ).length;
  const completionRate = closedInWindow / windowDays;
  const projectedDate =
    remaining > 0 && completionRate > 0
      ? lastHistoricalDay + Math.ceil(remaining / completionRate) * DAY_MS
      : remaining === 0
        ? lastHistoricalDay
        : undefined;
  const projectionPoints =
    projectedDate && projectedDate > lastHistoricalDay
      ? [
          { day: lastHistoricalDay, remaining },
          { day: projectedDate, remaining: 0 },
        ]
      : [];

  return {
    points,
    projectionPoints,
    today,
    remaining,
    completionRate,
    projectedDate,
    closedWithDates: closedDays.length,
  };
}

function toUtcDay(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return undefined;
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isNumber(value: number | undefined): value is number {
  return typeof value === "number";
}

function formatDateLabel(day: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(day));
}

function formatRate(rate: number) {
  if (rate <= 0) {
    return "-";
  }
  return `${rate.toFixed(rate >= 10 ? 0 : 1)}/day`;
}
