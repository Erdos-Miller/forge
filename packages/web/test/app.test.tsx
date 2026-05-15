import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/App";
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
  blockersByTaskId: {
    "F-0003": ["claimed by codex"],
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
});
