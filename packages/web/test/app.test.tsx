import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App, groupQueueTasks, selectTaskAfterRefresh, sortQueueTasks } from "../src/App";
import type { TaskGraphPayload } from "../src/api";

const payload: TaskGraphPayload = {
  repoRoot: "/repo",
  tasks: [
    {
      id: "F-0001",
      title: "Done task",
      kind: "task",
      status: "done",
      priority: "medium",
      parent: "",
      depends_on: [],
      claimed_by: "",
      scope: ["packages/core/**"],
      created_at: "2026-05-14T00:00:00-05:00",
      updated_at: "2026-05-14T00:00:00-05:00",
      body: "# Done task\n\nCompleted.",
      sourcePath: "/repo/.forge/tasks/F-0001.md",
    },
    {
      id: "F-0002",
      title: "Ready task",
      kind: "task",
      status: "open",
      priority: "high",
      area: "web",
      parent: "",
      depends_on: ["F-0001"],
      claimed_by: "",
      scope: ["packages/web/**"],
      created_at: "2026-05-14T00:00:00-05:00",
      updated_at: "2026-05-14T00:00:00-05:00",
      body: [
        "# Ready task",
        "",
        "## Why",
        "",
        "We need local visibility into the next task.",
        "",
        "## What success looks like",
        "",
        "Build the board.",
        "",
        "## Acceptance Criteria",
        "",
        "- Queue renders.",
        "",
        "## Verification",
        "",
        "- bun test",
        "",
      ].join("\n"),
      sourcePath: "/repo/.forge/tasks/F-0002.md",
    },
    {
      id: "F-0003",
      title: "Claimed task",
      kind: "task",
      status: "doing",
      priority: "medium",
      parent: "",
      depends_on: [],
      claimed_by: "codex",
      scope: ["packages/cli/**"],
      created_at: "2026-05-14T00:00:00-05:00",
      updated_at: "2026-05-14T00:00:00-05:00",
      body: "# Claimed task",
      sourcePath: "/repo/.forge/tasks/F-0003.md",
    },
  ],
  readyTaskIds: ["F-0002"],
  recommendedTaskIds: ["F-0002"],
  availabilityByTaskId: {
    "F-0001": "closed",
    "F-0002": "ready",
    "F-0003": "active",
  },
  blockersByTaskId: {
    "F-0003": [],
  },
  diagnostics: {
    missingDependencies: [],
    dependencyCycles: [],
    duplicateTaskIds: [],
  },
};

describe("App", () => {
  test("renders the queue, filters, and supporting summaries", () => {
    const html = renderToStaticMarkup(<App initialData={payload} />);

    expect(html).toContain("Queue");
    expect(html).toContain("ready");
    expect(html).toContain("blocked");
    expect(html).toContain("done");
    expect(html).toContain("Ready task");
    expect(html).toContain("Claimed task");
    expect(html).toContain("web");
    expect(html).toContain("Blocked open tasks");
    expect(html).toContain("Recent done");
  });

  test("renders selected task detail and markdown body", () => {
    const html = renderToStaticMarkup(<App initialData={payload} />);

    expect(html).toContain("packages/web/**");
    expect(html).toContain("Why");
    expect(html).toContain("What success looks like");
    expect(html).toContain("We need local visibility");
    expect(html).toContain("Build the board.");
    expect(html).toContain("<summary>Dependencies (1)</summary>");
  });

  test("renders graph diagnostics without replacing the page", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          diagnostics: {
            ...payload.diagnostics,
            missingDependencies: [{ taskId: "F-0004", dependencyId: "F-9999" }],
          },
        }}
      />,
    );

    expect(html).toContain("Task diagnostics");
    expect(html).toContain("F-0004 depends on missing task F-9999");
    expect(html).toContain("Ready task");
  });

  test("selectTaskAfterRefresh preserves selection and falls back when needed", () => {
    expect(selectTaskAfterRefresh("F-0003", payload, "all")).toBe("F-0003");
    expect(selectTaskAfterRefresh("F-9999", payload, "all")).toBe("F-0002");
    expect(selectTaskAfterRefresh("F-9999", payload, "packages/core")).toBe("F-0001");
    expect(selectTaskAfterRefresh("F-9999", payload, "missing")).toBeNull();
  });

  test("priority grouping renders urgent before high", () => {
    const highTask = { ...payload.tasks[1], id: "F-high", title: "High", priority: "high" as const };
    const urgentTask = {
      ...payload.tasks[1],
      id: "F-urgent",
      title: "Urgent",
      priority: "urgent" as const,
    };
    const queue = sortQueueTasks(
      [highTask, urgentTask],
      new Map([["F-high", 0]]),
      true,
    );
    const groups = groupQueueTasks(queue, "priority");

    expect(queue.map((task) => task.id)).toEqual(["F-high", "F-urgent"]);
    expect(groups.map(([priority]) => priority)).toEqual(["urgent", "high"]);
  });

  test("non-recommended tasks use explicit priority order", () => {
    const mediumTask = {
      ...payload.tasks[1],
      id: "F-medium",
      title: "Medium",
      priority: "medium" as const,
    };
    const highTask = { ...payload.tasks[1], id: "F-high", title: "High", priority: "high" as const };
    const urgentTask = {
      ...payload.tasks[1],
      id: "F-urgent",
      title: "Urgent",
      priority: "urgent" as const,
    };
    const queue = sortQueueTasks(
      [highTask, mediumTask, urgentTask],
      new Map([["F-medium", 0]]),
      true,
    );

    expect(queue.map((task) => task.id)).toEqual(["F-medium", "F-urgent", "F-high"]);
  });
});
