import type { Task } from "@forge/core";

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

export function AnalyticsView({
  doneTasks,
  scopedTasks,
}: {
  doneTasks: Task[];
  scopedTasks: Task[];
}) {
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
