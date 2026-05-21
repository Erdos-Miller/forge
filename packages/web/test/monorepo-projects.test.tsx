import { describe, expect, test } from "bun:test";
import type { Task } from "@forge/core";
import { renderToStaticMarkup } from "react-dom/server";
import { App, groupQueueTasks, selectTaskAfterRefresh, sortQueueTasks } from "../src/App";
import type { TaskGraphPayload } from "../src/api";
import { taskMatchesScope } from "../src/scopes";

describe("monorepo Project fixture", () => {
  test("keeps Projects, Areas, and edit scopes distinct", () => {
    const payload = monorepoProjectPayload();
    const html = renderToStaticMarkup(<App initialData={payload} />);

    expect(html).toContain('<option value="toolhub-wells">Toolhub Wells</option>');
    expect(html).toContain(
      '<option value="toolhub-travelers">Toolhub Travelers</option>',
    );
    expect(html).toContain('<option value="fluxchart">Fluxchart</option>');
    expect(html).toContain('<option value="shared-ui">Shared UI</option>');

    expect(html).toContain("<h3>web</h3>");
    expect(html).toContain("<h3>core</h3>");
    expect(html).toContain("<h3>docs</h3>");
    expect(html).toContain("<h3>test</h3>");
    expect(html).toContain("<h3>harness</h3>");

    expect(html).not.toContain(
      '<option value="product/toolhub/src/app/wells/**">',
    );
    expect(html).not.toContain(
      '<option value="lib/typescript/fluxchart/**">',
    );
  });

  test("filters by configured Project while preserving Area grouping", () => {
    const payload = monorepoProjectPayload();
    const wellsTasks = payload.tasks.filter((task) =>
      taskMatchesScope(task, "toolhub-wells", payload.scopeConfig),
    );
    const groupedAreas = groupQueueTasks(
      sortQueueTasks(wellsTasks, new Map(), false),
      "area",
      payload.availabilityByTaskId,
    ).map(([area]) => area);

    expect(wellsTasks.map((task) => task.title)).toEqual([
      "Toolhub Wells route",
      "Toolhub Wells docs",
    ]);
    expect(groupedAreas.sort()).toEqual(["docs", "web"]);
    expect(selectTaskAfterRefresh("missing", payload, "fluxchart")).toBe("F-mono-004");
    expect(selectTaskAfterRefresh("missing", payload, "all")).toBe("F-mono-001");
  });
});

function monorepoProjectPayload(): TaskGraphPayload {
  const tasks = [
    task({
      id: "F-mono-001",
      title: "Toolhub Wells route",
      area: "web",
      project: "toolhub-wells",
      scope: ["product/toolhub/src/app/wells/**"],
    }),
    task({
      id: "F-mono-002",
      title: "Toolhub Travelers workflow",
      area: "core",
      project: "toolhub-travelers",
      scope: ["product/toolhub/src/app/travelers/**", "lib/typescript/travelers/**"],
    }),
    task({
      id: "F-mono-003",
      title: "Toolhub Wells docs",
      area: "docs",
      project: "toolhub-wells",
      scope: ["product/toolhub/docs/wells/**"],
    }),
    task({
      id: "F-mono-004",
      title: "Fluxchart comparison harness",
      area: "harness",
      project: "fluxchart",
      scope: ["lib/typescript/fluxchart/comparisons/**"],
    }),
    task({
      id: "F-mono-005",
      title: "Shared UI regression tests",
      area: "test",
      project: "shared-ui",
      scope: ["lib/typescript/ui/**"],
    }),
  ];

  return {
    repoRoot: "/workspace/monorepo",
    tasks,
    readyTaskIds: tasks.map((task) => task.id),
    recommendedTaskIds: tasks.map((task) => task.id),
    availabilityByTaskId: Object.fromEntries(tasks.map((task) => [task.id, "ready"])),
    blockersByTaskId: Object.fromEntries(tasks.map((task) => [task.id, []])),
    coordinationByTaskId: {},
    scopeConfig: {
      source: "configured",
      projects: [
        {
          id: "toolhub-wells",
          label: "Toolhub Wells",
          paths: ["product/toolhub/src/app/wells/**", "product/toolhub/docs/wells/**"],
        },
        {
          id: "toolhub-travelers",
          label: "Toolhub Travelers",
          paths: ["product/toolhub/src/app/travelers/**", "lib/typescript/travelers/**"],
        },
        {
          id: "fluxchart",
          label: "Fluxchart",
          paths: ["lib/typescript/fluxchart/**"],
        },
        {
          id: "shared-ui",
          label: "Shared UI",
          paths: ["lib/typescript/ui/**"],
        },
      ],
      scopes: [],
    },
    diagnostics: {
      missingDependencies: [],
      dependencyCycles: [],
      duplicateTaskIds: [],
    },
  };
}

function task(input: Pick<Task, "id" | "title" | "area" | "project" | "scope">): Task {
  return {
    id: input.id,
    title: input.title,
    area: input.area,
    project: input.project,
    kind: "task",
    status: "open",
    priority: "high",
    parent: "",
    depends_on: [],
    claimed_by: "",
    scope: input.scope,
    created_at: "2026-05-21T00:00:00-05:00",
    updated_at: "2026-05-21T00:00:00-05:00",
    body: `# ${input.title}\n\nMonorepo fixture task.`,
    sourcePath: `/workspace/monorepo/.forge/tasks/${input.id}.md`,
  };
}
