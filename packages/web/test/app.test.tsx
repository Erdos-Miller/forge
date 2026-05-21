import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  App,
  getKeyboardQueueSelection,
  groupQueueTasks,
  selectTaskAfterRefresh,
  shouldIgnoreQueueShortcutTarget,
  sortQueueTasks,
} from "../src/App";
import type { TaskGraphPayload, WorkspaceTaskGraphPayload } from "../src/api";
import {
  getRepoIdFromSearch,
  getTaskIdFromSearch,
  getVisibleSelectedTask,
  writeTaskSelectionToUrl,
} from "../src/url-selection";
import { getGraphForRepo } from "../src/workspace";

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
        "## Execution Plan",
        "",
        "Summary: build the queue view.",
        "",
        "## Notes",
        "",
        "Keep the task readable.",
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
  coordinationByTaskId: {},
  scopeConfig: {
    source: "inferred",
    scopes: [
      { id: "packages/cli", label: "packages/cli", paths: ["packages/cli/**"] },
      { id: "packages/core", label: "packages/core", paths: ["packages/core/**"] },
      { id: "packages/web", label: "packages/web", paths: ["packages/web/**"] },
    ],
  },
  diagnostics: {
    missingDependencies: [],
    dependencyCycles: [],
    duplicateTaskIds: [],
  },
};

const apiGraph = graphPayload("/workspace/api", [
  {
    ...payload.tasks[1],
    id: "F-api",
    title: "API workspace task",
    area: "api",
    sourcePath: "/workspace/api/.forge/tasks/F-api.md",
  },
]);

const webGraph = graphPayload("/workspace/web", [
  {
    ...payload.tasks[1],
    id: "F-web",
    title: "Web workspace task",
    area: "web",
    sourcePath: "/workspace/web/.forge/tasks/F-web.md",
  },
]);

const workspacePayload: WorkspaceTaskGraphPayload = {
  ...apiGraph,
  workspace: {
    startDir: "/workspace",
    roots: [
      workspaceRoot("api", apiGraph),
      workspaceRoot("web", webGraph),
    ],
  },
};

const emptyWorkspacePayload: WorkspaceTaskGraphPayload = {
  repoRoot: "/workspace",
  tasks: [],
  readyTaskIds: [],
  recommendedTaskIds: [],
  availabilityByTaskId: {},
  blockersByTaskId: {},
  coordinationByTaskId: {},
  scopeConfig: { source: "inferred", scopes: [] },
  diagnostics: {
    missingDependencies: [],
    dependencyCycles: [],
    duplicateTaskIds: [],
  },
  workspace: {
    startDir: "/workspace",
    roots: [],
  },
};

function graphPayload(repoRoot: string, tasks: TaskGraphPayload["tasks"]): TaskGraphPayload {
  return {
    repoRoot,
    tasks,
    readyTaskIds: tasks.map((task) => task.id),
    recommendedTaskIds: tasks.map((task) => task.id),
    availabilityByTaskId: Object.fromEntries(tasks.map((task) => [task.id, "ready"])),
    blockersByTaskId: Object.fromEntries(tasks.map((task) => [task.id, []])),
    coordinationByTaskId: {},
    scopeConfig: {
      source: "inferred",
      scopes: Array.from(new Set(tasks.flatMap((task) => task.scope))).map((scope) => ({
        id: scope.replace(/\/\*\*$/, ""),
        label: scope.replace(/\/\*\*$/, ""),
        paths: [scope],
      })),
    },
    diagnostics: {
      missingDependencies: [],
      dependencyCycles: [],
      duplicateTaskIds: [],
    },
  };
}

function workspaceRoot(id: string, graph: TaskGraphPayload) {
  return {
    id,
    displayName: id,
    path: graph.repoRoot,
    status: "ok" as const,
    taskCount: graph.tasks.length,
    graph,
    summary: {
      totalTasks: graph.tasks.length,
      readyTaskIds: graph.readyTaskIds,
      recommendedTaskIds: graph.recommendedTaskIds,
      availabilityCounts: {
        active: 0,
        blocked: 0,
        claimed: 0,
        closed: 0,
        ready: graph.tasks.length,
      },
      diagnostics: graph.diagnostics,
    },
  };
}

function withMockWindow<T>(
  search: string,
  action: (mock: { replaceCalls: string[] }) => T,
): T {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const hadWindow = "window" in globalThis;
  const replaceCalls: string[] = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hash: "",
        href: `http://forge.local/${search}`,
        pathname: "/",
        search,
      },
      history: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          replaceCalls.push(url);
        },
      },
    },
  });

  try {
    return action({ replaceCalls });
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

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
    expect(html).toContain("Execution Plan");
    expect(html).toContain("Summary: build the queue view.");
    expect(html).toContain("<summary>Dependencies (1)</summary>");
  });

  test("defaults all-done queues to hidden completed rows", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          tasks: [payload.tasks[0]],
          readyTaskIds: [],
          recommendedTaskIds: [],
          availabilityByTaskId: { "F-0001": "closed" },
          blockersByTaskId: { "F-0001": [] },
        }}
      />,
    );

    expect(html).toContain("No unfinished tasks match this filter.");
    expect(html).toContain("No queue row is visible for this filter.");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("No tasks match this filter.");
    expect(html).not.toContain("Completed.");
    expect(html).not.toContain("Status is done.");
  });

  test("selects a visible task from the URL on initial render", () => {
    const html = withMockWindow("?task=F-0003", () =>
      renderToStaticMarkup(<App initialData={payload} />),
    );

    expect(html).toContain("<h2>Claimed task</h2>");
    expect(html).toContain("claimed by codex");
  });

  test("does not fall back to an unrelated task for invalid URL task ids", () => {
    const html = withMockWindow("?task=F-9999", () =>
      renderToStaticMarkup(<App initialData={payload} />),
    );

    expect(html).toContain("No queue row is visible for this filter.");
    expect(html).not.toContain("<h2>Ready task</h2>");
  });

  test("keeps URL-requested hidden done tasks out of the detail pane", () => {
    const html = withMockWindow("?task=F-0001", () =>
      renderToStaticMarkup(<App initialData={payload} />),
    );

    expect(html).toContain("No queue row is visible for this filter.");
    expect(html).not.toContain("Completed.");
    expect(html).not.toContain("Status is done.");
  });

  test("renders the expected brief before supporting details", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          tasks: [
            {
              ...payload.tasks[1],
              body: [
                "# Ready task",
                "",
                "## Acceptance Criteria",
                "",
                "- Queue renders.",
                "",
                "## Execution Plan",
                "",
                "Summary: build it.",
                "",
                "## Notes",
                "",
                "Visible note.",
                "",
                "## Verification",
                "",
                "- bun test",
                "",
                "## Extra Review Notes",
                "",
                "Unknown section.",
                "",
              ].join("\n"),
            },
          ],
          readyTaskIds: ["F-0002"],
          recommendedTaskIds: ["F-0002"],
          availabilityByTaskId: { "F-0002": "ready" },
          blockersByTaskId: { "F-0002": [] },
        }}
      />,
    );

    expect(html).toContain('<section class="markdown taskSection normal"><h3>Execution Plan</h3>');
    expect(html.indexOf("Acceptance Criteria")).toBeLessThan(html.indexOf("Execution Plan"));
    expect(html.indexOf("Notes")).toBeLessThan(html.indexOf("Verification"));
    expect(html.indexOf("Verification")).toBeLessThan(html.indexOf("Execution Plan"));
    expect(html.indexOf("Execution Plan")).toBeLessThan(html.indexOf("Additional Details"));
    expect(html).toContain("Unknown section.");
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

  test("renders coordination warnings for selected blocking and review files", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          coordinationByTaskId: {
            "F-0002": {
              recommendation: "stop",
              summary: {
                blocking: 1,
                review: 1,
                non_blocking: 0,
                total: 2,
                clean: false,
              },
              files: [
                {
                  path: "packages/web/src/App.tsx",
                  status: " M",
                  classification: "blocking",
                  reason: "inside_task_scope",
                },
                {
                  path: "package.json",
                  status: " M",
                  classification: "review",
                  reason: "shared_file",
                },
              ],
            },
          },
        }}
      />,
    );

    expect(html).toContain("Worktree coordination");
    expect(html).toContain("1 blocking / 1 review");
    expect(html).toContain("Stop before continuing.");
    expect(html).toContain("packages/web/src/App.tsx");
  });

  test("does not render coordination warnings for non-blocking files only", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          coordinationByTaskId: {
            "F-0002": {
              recommendation: "continue",
              summary: {
                blocking: 0,
                review: 0,
                non_blocking: 1,
                total: 1,
                clean: false,
              },
              files: [
                {
                  path: ".forge/tasks/F-9999.md",
                  status: "??",
                  classification: "non_blocking",
                  reason: "future_task_file",
                },
              ],
            },
          },
        }}
      />,
    );

    expect(html).not.toContain("Worktree coordination");
    expect(html).not.toContain("F-9999.md");
  });

  test("hides Project selector instead of rendering inferred edit-scope options", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={graphPayload("/workspace", [
          { ...payload.tasks[1], id: "F-web", scope: ["packages/web/**"] },
          {
            ...payload.tasks[1],
            id: "F-readme",
            title: "Readme cleanup",
            scope: ["README.md"],
          },
          {
            ...payload.tasks[1],
            id: "F-component",
            title: "Component cleanup",
            scope: ["lib/typescript/ui/src/components/Wells/**"],
          },
        ])}
      />,
    );

    expect(html).not.toContain(">Project<");
    expect(html).not.toContain('<option value="packages/web">packages/web</option>');
    expect(html).not.toContain('<option value="lib/typescript/ui">lib/typescript/ui</option>');
    expect(html).not.toContain('<option value="Other">Other</option>');
    expect(html).not.toContain('<option value="README.md">README.md</option>');
    expect(html).not.toContain("components/Wells");
  });

  test("renders configured Project labels while preserving raw task scope detail", () => {
    const configuredPayload: TaskGraphPayload = {
      ...payload,
      scopeConfig: {
        source: "configured",
        scopes: [
          { id: "ui", label: "UI", paths: ["packages/web/**"] },
          { id: "backend", label: "Backend", paths: ["packages/core/**"] },
        ],
      },
    };

    const html = renderToStaticMarkup(<App initialData={configuredPayload} />);

    expect(html).toContain(">Project<");
    expect(html).toContain("All projects</option>");
    expect(html).toContain('<option value="ui">UI</option>');
    expect(html).toContain('<option value="backend">Backend</option>');
    expect(html).toContain("Edit scope packages/web/**");
  });

  test("uses configured Project matching when selecting after refresh", () => {
    const configuredPayload: TaskGraphPayload = {
      ...payload,
      scopeConfig: {
        source: "configured",
        scopes: [{ id: "ui", label: "UI", paths: ["packages/web/**"] }],
      },
    };

    expect(selectTaskAfterRefresh("missing", configuredPayload, "ui")).toBe("F-0002");
    expect(selectTaskAfterRefresh("missing", configuredPayload, "unknown")).toBe("F-0002");
  });

  test("keeps unmatched tasks visible under All projects only", () => {
    const unmatchedPayload = graphPayload("/workspace", [
      { ...payload.tasks[1], id: "F-web", scope: ["packages/web/**"] },
      { ...payload.tasks[2], id: "F-docs", scope: ["docs/**"] },
    ]);
    const configuredPayload: TaskGraphPayload = {
      ...unmatchedPayload,
      scopeConfig: {
        source: "configured",
        projects: [{ id: "ui", label: "UI", paths: ["packages/web/**"] }],
        scopes: [{ id: "ui", label: "UI", paths: ["packages/web/**"] }],
      },
    };

    expect(selectTaskAfterRefresh("missing", configuredPayload, "all")).toBe("F-web");
    expect(selectTaskAfterRefresh("F-docs", configuredPayload, "all")).toBe("F-docs");
    expect(selectTaskAfterRefresh("F-docs", configuredPayload, "ui")).toBe("F-web");
  });

  test("ignores stale Project filters for repos without project config", () => {
    const noConfigPayload = graphPayload("/workspace", [
      { ...payload.tasks[1], id: "F-web", scope: ["packages/web/**"] },
      { ...payload.tasks[2], id: "F-core", scope: ["packages/core/**"] },
    ]);

    expect(selectTaskAfterRefresh("missing", noConfigPayload, "packages/core")).toBe("F-web");
  });

  test("renders an empty workspace without a repo switcher", () => {
    const html = renderToStaticMarkup(<App initialData={emptyWorkspacePayload} />);

    expect(html).toContain("Queue");
    expect(html).toContain("No tasks match this filter.");
    expect(html).not.toContain("All repos");
  });

  test("keeps a one-root workspace visually close to the single-root app", () => {
    const oneRootPayload: WorkspaceTaskGraphPayload = {
      ...apiGraph,
      workspace: {
        startDir: "/workspace",
        roots: [workspaceRoot("api", apiGraph)],
      },
    };

    const html = renderToStaticMarkup(<App initialData={oneRootPayload} />);

    expect(html).toContain("API workspace task");
    expect(html).toContain("/workspace/api");
    expect(html).not.toContain("All repos");
  });

  test("renders an all-roots aggregate queue for many-root workspaces", () => {
    const html = renderToStaticMarkup(<App initialData={workspacePayload} />);

    expect(html).toContain("All repos");
    expect(html).toContain("API workspace task");
    expect(html).toContain("Web workspace task");
    expect(html).toContain('class="badge">api</span>');
    expect(html).toContain('class="badge">web</span>');
  });

  test("qualifies configured scopes in an all-roots aggregate queue", () => {
    const configuredApiGraph: TaskGraphPayload = {
      ...apiGraph,
      scopeConfig: {
        source: "configured",
        scopes: [{ id: "ui", label: "UI", paths: ["packages/web/**"] }],
      },
    };
    const configuredWebGraph: TaskGraphPayload = {
      ...webGraph,
      scopeConfig: {
        source: "configured",
        scopes: [{ id: "ui", label: "UI", paths: ["packages/web/**"] }],
      },
    };
    const configuredWorkspacePayload: WorkspaceTaskGraphPayload = {
      ...configuredApiGraph,
      workspace: {
        startDir: "/workspace",
        roots: [
          workspaceRoot("api", configuredApiGraph),
          workspaceRoot("web", configuredWebGraph),
        ],
      },
    };
    const aggregateGraph = getGraphForRepo(configuredWorkspacePayload, "all");

    expect(aggregateGraph.scopeConfig.scopes).toEqual([
      {
        id: "api::ui",
        label: "api / UI",
        paths: ["packages/web/**"],
        rootId: "api",
      },
      {
        id: "web::ui",
        label: "web / UI",
        paths: ["packages/web/**"],
        rootId: "web",
      },
    ]);
    expect(selectTaskAfterRefresh("missing", aggregateGraph, "api::ui")).toBe(
      "api::F-api",
    );
    expect(selectTaskAfterRefresh("api::F-api", aggregateGraph, "web::ui")).toBe(
      "web::F-web",
    );
  });

  test("renders stable header controls for long worktree and project labels", () => {
    const longGraph: TaskGraphPayload = {
      ...graphPayload("/workspace/very-long-worktree", [
        {
          ...payload.tasks[1],
          id: "F-long",
          title: "Long label task",
          scope: ["packages/web/src/components/very/deep/feature/**"],
        },
      ]),
      scopeConfig: {
        source: "configured",
        scopes: [
          {
            id: "long-project",
            label: "Very long project name for truncation",
            paths: ["packages/web/src/components/very/deep/feature/**"],
          },
        ],
      },
    };
    const longPayload: WorkspaceTaskGraphPayload = {
      ...longGraph,
      workspace: {
        startDir: "/workspace",
        roots: [
          {
            ...workspaceRoot("long-worktree", longGraph),
            displayName: "very-long-worktree-name-for-header-truncation",
          },
          workspaceRoot("api", apiGraph),
        ],
      },
    };
    const html = renderToStaticMarkup(<App initialData={longPayload} />);

    expect(html).toContain('class="headerControls"');
    expect(html.indexOf(">Worktree<")).toBeLessThan(html.indexOf(">Project<"));
    expect(html).not.toContain(">Scope<");
    expect(html.indexOf('class="headerControls"')).toBeLessThan(
      html.indexOf('class="topNav"'),
    );
    expect(html).toContain("very-long-worktree-name-for-header-truncation");
    expect(html).toContain("Very long project name for truncation");
  });

  test("selects a repo and task from URL params", () => {
    const html = withMockWindow("?repo=web&task=F-web", () =>
      renderToStaticMarkup(<App initialData={workspacePayload} />),
    );

    expect(html).toContain("<h2>Web workspace task</h2>");
    expect(html).toContain("/workspace/web");
    expect(html).not.toContain("<h2>API workspace task</h2>");
  });

  test("renders doing claimed rows as in progress instead of blocked by blocker count", () => {
    const activeTask = {
      ...payload.tasks[1],
      id: "F-active",
      title: "Urgent active task",
      status: "doing" as const,
      priority: "urgent" as const,
      claimed_by: "codex",
    };
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          tasks: [activeTask],
          readyTaskIds: [],
          recommendedTaskIds: [],
          availabilityByTaskId: { "F-active": "active" },
          blockersByTaskId: {
            "F-active": ["dependency F-0001 is open", "missing dependency F-9999"],
          },
        }}
      />,
    );

    expect(html).toContain("Urgent active task");
    expect(html).toContain("in progress");
    expect(html).not.toContain("blocked by 2");
  });

  test("renders claimed open rows and real dependency-blocked rows distinctly", () => {
    const claimedTask = {
      ...payload.tasks[1],
      id: "F-claimed",
      title: "Claimed open task",
      status: "open" as const,
      claimed_by: "codex",
    };
    const blockedTask = {
      ...payload.tasks[1],
      id: "F-blocked",
      title: "Dependency blocked task",
      status: "open" as const,
      claimed_by: "",
    };
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          tasks: [claimedTask, blockedTask],
          readyTaskIds: [],
          recommendedTaskIds: [],
          availabilityByTaskId: {
            "F-claimed": "claimed",
            "F-blocked": "blocked",
          },
          blockersByTaskId: {
            "F-claimed": [],
            "F-blocked": ["dependency F-0001 is open", "missing dependency F-9999"],
          },
        }}
      />,
    );

    expect(html).toContain("claimed by codex");
    expect(html).toContain("blocked by 2");
  });

  test("selectTaskAfterRefresh preserves selection and falls back when needed", () => {
    expect(selectTaskAfterRefresh("F-0003", payload, "all")).toBe("F-0003");
    expect(selectTaskAfterRefresh("F-9999", payload, "all")).toBe("F-0002");
    expect(selectTaskAfterRefresh("F-9999", payload, "all", false, "F-9999")).toBe(
      "F-9999",
    );
    expect(selectTaskAfterRefresh("F-9999", payload, "packages/core")).toBe("F-0002");
    expect(selectTaskAfterRefresh("F-9999", payload, "packages/core", true)).toBe("F-0002");
    expect(selectTaskAfterRefresh("F-9999", payload, "missing")).toBe("F-0002");
  });

  test("URL helpers parse, preserve, and update task selection", () => {
    expect(getTaskIdFromSearch("?task=F-0002")).toBe("F-0002");
    expect(getTaskIdFromSearch("?task=")).toBeNull();
    expect(getRepoIdFromSearch("?repo=web&task=F-0002")).toBe("web");
    expect(getRepoIdFromSearch("?repo=&task=F-0002")).toBeNull();
    expect(getVisibleSelectedTask("F-9999", [payload.tasks[1]], "F-9999")).toBeNull();

    const replaceCalls = withMockWindow("?task=F-0002", ({ replaceCalls }) => {
      writeTaskSelectionToUrl("F-0003");
      writeTaskSelectionToUrl("F-0003", "web");
      return replaceCalls;
    });

    expect(replaceCalls).toEqual(["/?task=F-0003", "/?task=F-0003&repo=web"]);
  });

  test("clears detail when hide-done leaves no visible queue rows", () => {
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          tasks: [payload.tasks[0]],
          readyTaskIds: [],
          recommendedTaskIds: [],
          availabilityByTaskId: { "F-0001": "closed" },
          blockersByTaskId: { "F-0001": [] },
        }}
      />,
    );

    expect(html).toContain("No unfinished tasks match this filter.");
    expect(html).toContain("No queue row is visible for this filter.");
    expect(html).not.toContain("No tasks match this filter.");
    expect(html).not.toContain("Completed.");
    expect(html).not.toContain("Status is done.");
  });

  test("refresh selection follows the user-controlled Show done setting", () => {
    const doneOnlyPayload = {
      ...payload,
      tasks: [payload.tasks[0]],
      readyTaskIds: [],
      recommendedTaskIds: [],
      availabilityByTaskId: { "F-0001": "closed" },
      blockersByTaskId: { "F-0001": [] },
    };

    expect(sortQueueTasks(doneOnlyPayload.tasks, new Map(), false)).toEqual([]);
    expect(sortQueueTasks(doneOnlyPayload.tasks, new Map(), true).map((task) => task.id)).toEqual([
      "F-0001",
    ]);
    expect(selectTaskAfterRefresh("F-0001", doneOnlyPayload, "all", false)).toBeNull();
    expect(selectTaskAfterRefresh("F-0001", doneOnlyPayload, "all", true)).toBe("F-0001");
    expect(selectTaskAfterRefresh("F-0001", doneOnlyPayload, "packages/web", true)).toBe("F-0001");
  });

  test("falls back to the first visible queue row when selection is hidden", () => {
    expect(selectTaskAfterRefresh("F-0001", payload, "all", false)).toBe("F-0002");
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

  test("priority grouping separates mixed availability within an urgent group", () => {
    const readyTask = {
      ...payload.tasks[1],
      id: "F-ready",
      title: "Ready",
      priority: "urgent" as const,
    };
    const activeTask = {
      ...payload.tasks[1],
      id: "F-active",
      title: "Active",
      status: "doing" as const,
      priority: "urgent" as const,
      claimed_by: "codex",
    };
    const claimedTask = {
      ...payload.tasks[1],
      id: "F-claimed",
      title: "Claimed",
      status: "open" as const,
      priority: "urgent" as const,
      claimed_by: "codex",
    };
    const blockedTask = {
      ...payload.tasks[1],
      id: "F-blocked",
      title: "Blocked",
      status: "open" as const,
      priority: "urgent" as const,
    };
    const doneTask = {
      ...payload.tasks[0],
      id: "F-done",
      title: "Done",
      priority: "urgent" as const,
    };
    const groups = groupQueueTasks(
      sortQueueTasks(
        [claimedTask, blockedTask, activeTask, doneTask, readyTask],
        new Map([["F-ready", 0]]),
        true,
      ),
      "priority",
      {
        "F-ready": "ready",
        "F-active": "active",
        "F-claimed": "claimed",
        "F-blocked": "blocked",
        "F-done": "closed",
      },
    );

    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("urgent");
    expect(groups[0][1].map((section) => section.label)).toEqual([
      "Ready",
      "In progress",
      "Claimed",
      "Blocked",
      "Done",
    ]);
    expect(groups[0][1].map((section) => section.tasks.map((task) => task.id))).toEqual([
      ["F-ready"],
      ["F-active"],
      ["F-claimed"],
      ["F-blocked"],
      ["F-done"],
    ]);
  });

  test("non-ready rows render without actionable queue rank", () => {
    const activeTask = {
      ...payload.tasks[1],
      id: "F-active",
      title: "Active",
      status: "doing" as const,
      priority: "urgent" as const,
      claimed_by: "codex",
    };
    const html = renderToStaticMarkup(
      <App
        initialData={{
          ...payload,
          tasks: [payload.tasks[1], activeTask],
          readyTaskIds: ["F-0002"],
          recommendedTaskIds: ["F-0002"],
          availabilityByTaskId: {
            "F-0002": "ready",
            "F-active": "active",
          },
          blockersByTaskId: {
            "F-0002": [],
            "F-active": [],
          },
        }}
      />,
    );

    expect(html).toContain(">Ready<");
    expect(html).toContain(">In progress<");
    expect(html).toContain('class="rank ">1</span>');
    expect(html).toContain('class="rank mutedRank">-</span>');
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

  test("keyboard queue selection handles ArrowDown, ArrowUp, Home, and End", () => {
    const tasks = [{ id: "F-0001" }, { id: "F-0002" }, { id: "F-0003" }];

    expect(getKeyboardQueueSelection(tasks, "F-0001", "ArrowDown")).toEqual({
      handled: true,
      taskId: "F-0002",
    });
    expect(getKeyboardQueueSelection(tasks, "F-0002", "ArrowUp")).toEqual({
      handled: true,
      taskId: "F-0001",
    });
    expect(getKeyboardQueueSelection(tasks, "F-0002", "Home")).toEqual({
      handled: true,
      taskId: "F-0001",
    });
    expect(getKeyboardQueueSelection(tasks, "F-0002", "End")).toEqual({
      handled: true,
      taskId: "F-0003",
    });
    expect(getKeyboardQueueSelection(tasks, "F-0002", "Enter")).toEqual({
      handled: false,
      taskId: "F-0002",
    });
  });

  test("keyboard queue selection follows filtered visible order", () => {
    const webDone = {
      ...payload.tasks[0],
      id: "F-web-done",
      title: "Web done",
      priority: "urgent" as const,
      scope: ["packages/web/**"],
    };
    const webHigh = {
      ...payload.tasks[1],
      id: "F-web-high",
      title: "Web high",
      priority: "high" as const,
    };
    const webUrgent = {
      ...payload.tasks[1],
      id: "F-web-urgent",
      title: "Web urgent",
      priority: "urgent" as const,
    };
    const coreUrgent = {
      ...payload.tasks[1],
      id: "F-core-urgent",
      title: "Core urgent",
      priority: "urgent" as const,
      scope: ["packages/core/**"],
    };
    const sorted = sortQueueTasks(
      [webHigh, webUrgent, coreUrgent, webDone].filter((task) =>
        task.scope.some((scope) => scope.startsWith("packages/web")),
      ),
      new Map([["F-web-high", 0]]),
      false,
    );
    const visible = groupQueueTasks(sorted, "priority", {
      "F-web-high": "ready",
      "F-web-urgent": "ready",
    }).flatMap(([, sections]) => sections.flatMap((section) => section.tasks));

    expect(visible.map((task) => task.id)).toEqual(["F-web-urgent", "F-web-high"]);
    expect(getKeyboardQueueSelection(visible, "F-web-urgent", "ArrowDown")).toEqual({
      handled: true,
      taskId: "F-web-high",
    });
  });

  test("keyboard queue shortcuts are ignored from form and control focus", () => {
    expect(shouldIgnoreQueueShortcutTarget({ tagName: "INPUT" } as any)).toBe(true);
    expect(shouldIgnoreQueueShortcutTarget({ tagName: "SELECT" } as any)).toBe(true);
    expect(shouldIgnoreQueueShortcutTarget({ tagName: "TEXTAREA" } as any)).toBe(true);
    expect(shouldIgnoreQueueShortcutTarget({ tagName: "BUTTON" } as any)).toBe(true);
    expect(shouldIgnoreQueueShortcutTarget({ tagName: "DIV" } as any)).toBe(false);
  });
});
