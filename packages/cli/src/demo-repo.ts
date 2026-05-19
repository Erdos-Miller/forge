import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TaskPriority, TaskStatus } from "@forge/core";

interface DemoTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  area: string;
  scope: string[];
  depends_on?: string[];
  claimed_by?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
  body: string;
}

export interface DemoForgeRepo {
  repoRoot: string;
  cleanup: () => Promise<void>;
}

export async function createDemoForgeRepo(): Promise<DemoForgeRepo> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-demo-"));
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(path.join(repoRoot, "README.md"), "# Forge Demo\n");
  await fs.mkdir(path.join(repoRoot, "packages", "web", "src"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "packages", "api", "src"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "packages", "docs"), { recursive: true });
  await Promise.all(demoTasks.map((task) => writeDemoTask(tasksDir, task)));

  return {
    repoRoot,
    cleanup: () => fs.rm(repoRoot, { recursive: true, force: true }),
  };
}

async function writeDemoTask(tasksDir: string, task: DemoTask): Promise<void> {
  await fs.writeFile(
    path.join(tasksDir, `${task.id}-${slugify(task.title)}.md`),
    formatDemoTask(task),
  );
}

function formatDemoTask(task: DemoTask): string {
  const isClosed = task.status === "done" || task.status === "canceled";
  return [
    "---",
    `id: ${task.id}`,
    `title: ${JSON.stringify(task.title)}`,
    "kind: task",
    `status: ${task.status}`,
    `priority: ${task.priority}`,
    'parent: "F-1000"',
    `depends_on:${formatList(task.depends_on ?? [])}`,
    `claimed_by: ${JSON.stringify(task.claimed_by ?? "")}`,
    `area: ${JSON.stringify(task.area)}`,
    "scope:",
    ...task.scope.map((entry) => `  - ${JSON.stringify(entry)}`),
    `created_at: ${task.created_at}`,
    `updated_at: ${task.updated_at}`,
    `closed_at: ${isClosed ? task.closed_at : ""}`,
    `close_reason: ${JSON.stringify(isClosed ? task.close_reason ?? "Demo work complete" : "")}`,
    'blocked_reason: ""',
    'review_reason: ""',
    "---",
    "",
    task.body,
    "",
  ].join("\n");
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return " []";
  }
  return "\n" + values.map((value) => `  - ${JSON.stringify(value)}`).join("\n");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function body(input: {
  why: string;
  success: string;
  acceptance: string[];
  plan?: string;
  notes?: string;
  verification?: string[];
}): string {
  return [
    `## Why`,
    "",
    input.why,
    "",
    "## What success looks like",
    "",
    input.success,
    "",
    "## Acceptance Criteria",
    "",
    ...input.acceptance.map((item) => `- ${item}`),
    "",
    "## Execution Plan",
    "",
    input.plan ?? "Summary: Keep the change small and verify the customer-facing path.",
    "",
    "## Notes",
    "",
    input.notes ?? "Demo data intentionally mixes states, priorities, areas, and dependencies.",
    "",
    "## Verification",
    "",
    ...(input.verification ?? ["Run the focused test path.", "Open the web viewer and inspect the task."]).map(
      (item) => `- ${item}`,
    ),
  ].join("\n");
}

const demoTasks: DemoTask[] = [
  {
    id: "F-1001",
    title: "Ship team-ready queue screenshot",
    status: "open",
    priority: "urgent",
    area: "web",
    scope: ["packages/web/**"],
    depends_on: ["F-1004"],
    created_at: "2026-05-13T09:00:00-05:00",
    updated_at: "2026-05-18T15:30:00-05:00",
    body: body({
      why: "The team needs a quick visual of Forge that communicates the one-agent queue without a long walkthrough.",
      success: "The queue opens with realistic work, a readable selected task, and no empty-board state.",
      acceptance: [
        "The default queue includes ready, in-progress, blocked, and recent done work.",
        "The selected task explains why the work matters in the first paragraph.",
        "A screenshot can be taken without editing local project task files.",
      ],
      plan: "Summary: Use the demo task graph and capture the queue at desktop width.",
    }),
  },
  {
    id: "F-1002",
    title: "Polish task detail readability",
    status: "open",
    priority: "high",
    area: "web",
    scope: ["packages/web/src/**"],
    depends_on: ["F-1004"],
    created_at: "2026-05-12T10:15:00-05:00",
    updated_at: "2026-05-18T12:00:00-05:00",
    body: body({
      why:
        "Agents and reviewers scan the detail pane first, so the task should read " +
        "like a useful brief, not a dump of metadata.",
      success: "Why, success, acceptance criteria, and notes align in a stable two-column reading rhythm.",
      acceptance: [
        "The detail pane keeps the title, why, and success visible above collapsed low-priority sections.",
        "Verification and dependencies stay available without dominating the card.",
        "Long task titles wrap without overlapping metadata.",
      ],
    }),
  },
  {
    id: "F-1003",
    title: "Add keyboard selection hints",
    status: "open",
    priority: "medium",
    area: "web",
    scope: ["packages/web/src/**"],
    depends_on: ["F-1002"],
    created_at: "2026-05-12T11:00:00-05:00",
    updated_at: "2026-05-17T16:45:00-05:00",
    body: body({
      why:
        "The queue already supports keyboard navigation, but the affordance is " +
        "invisible to someone trying Forge for the first time.",
      success:
        "A subtle footer cue makes arrow-key navigation discoverable without adding " +
        "tutorial copy to the main surface.",
      acceptance: [
        "The hint is quiet and does not compete with task content.",
        "The hint disappears from screenshots if the viewport is too short.",
      ],
    }),
  },
  {
    id: "F-1004",
    title: "Stabilize demo data contract",
    status: "done",
    priority: "urgent",
    area: "core",
    scope: ["packages/core/**", "packages/cli/**"],
    created_at: "2026-05-10T14:00:00-05:00",
    updated_at: "2026-05-13T16:00:00-05:00",
    closed_at: "2026-05-13T16:00:00-05:00",
    close_reason: "Demo payload validates through the normal task parser.",
    body: body({
      why: "Demo mode should exercise the same parser and graph analysis as real task files.",
      success: "Every demo task is ordinary Markdown with normal Forge frontmatter.",
      acceptance: [
        "No special UI-only task shape is required.",
        "Demo files can be inspected on disk while the server is running.",
      ],
    }),
  },
  {
    id: "F-1005",
    title: "Wire task links into release notes",
    status: "doing",
    priority: "high",
    area: "docs",
    scope: ["packages/docs/**", "README.md"],
    claimed_by: "codex",
    depends_on: ["F-1004"],
    created_at: "2026-05-14T09:30:00-05:00",
    updated_at: "2026-05-18T10:30:00-05:00",
    body: body({
      why: "Terminal links are useful only if people know they exist and can try them from a normal workflow.",
      success:
        "The README shows how to start Forge, list tasks with links, and open a " +
        "selected task in the web viewer.",
      acceptance: [
        "The command examples use `forge web` and `forge list --links=always`.",
        "The wording stays short enough for a release note.",
      ],
      notes: "Claimed to demonstrate in-progress work in the queue.",
    }),
  },
  {
    id: "F-1006",
    title: "Design screenshot-safe dark theme",
    status: "done",
    priority: "high",
    area: "design",
    scope: ["packages/web/src/styles.css"],
    created_at: "2026-05-09T13:20:00-05:00",
    updated_at: "2026-05-12T17:15:00-05:00",
    closed_at: "2026-05-12T17:15:00-05:00",
    close_reason: "Dark theme approved for internal screenshots.",
    body: body({
      why: "The first screenshot should feel like a focused engineering tool, not a marketing page.",
      success: "The UI uses flat dark surfaces, clear borders, quiet metadata, and readable task content.",
      acceptance: [
        "No gradients or decorative backgrounds.",
        "Priority is represented with small dots.",
        "Rows stay dense enough for 20 to 30 tasks.",
      ],
    }),
  },
  {
    id: "F-1007",
    title: "Handle empty real repositories",
    status: "open",
    priority: "medium",
    area: "web",
    scope: ["packages/web/**"],
    depends_on: ["F-1013"],
    created_at: "2026-05-15T11:30:00-05:00",
    updated_at: "2026-05-18T11:30:00-05:00",
    body: body({
      why: "A brand-new repo should explain what Forge needs without pretending there is work to rank.",
      success: "An empty real repo shows a compact setup state with the first CLI command to run.",
      acceptance: [
        "The state is distinct from an all-done queue.",
        "The message does not appear in demo mode.",
      ],
    }),
  },
  {
    id: "F-1008",
    title: "Add API smoke harness",
    status: "open",
    priority: "high",
    area: "test",
    scope: ["packages/web/test/**"],
    depends_on: ["F-1004"],
    created_at: "2026-05-15T12:00:00-05:00",
    updated_at: "2026-05-18T14:00:00-05:00",
    body: body({
      why:
        "The web board previously broke when API payload shape drifted, so demo mode " +
        "should keep pressure on the live API path.",
      success: "A live smoke test starts the server and verifies `/api/tasks` plus the web entry point.",
      acceptance: [
        "The harness uses a disposable task repo.",
        "It checks for task JSON and rendered HTML.",
        "Failure messages include the served URL.",
      ],
    }),
  },
  {
    id: "F-1009",
    title: "Reduce queue row metadata noise",
    status: "done",
    priority: "medium",
    area: "web",
    scope: ["packages/web/src/App.tsx"],
    created_at: "2026-05-11T09:45:00-05:00",
    updated_at: "2026-05-14T13:00:00-05:00",
    closed_at: "2026-05-14T13:00:00-05:00",
    close_reason: "Rows now prioritize titles and visual priority cues.",
    body: body({
      why: "Area, status, and dependency tags repeated information already visible elsewhere.",
      success: "Rows lead with title, priority cue, and only necessary state badges.",
      acceptance: [
        "Area badges only appear in priority grouping.",
        "Dependency details move to the detail pane.",
      ],
    }),
  },
  {
    id: "F-1010",
    title: "Add optimistic task claiming action",
    status: "blocked",
    priority: "low",
    area: "cli",
    scope: ["packages/cli/**", "packages/web/**"],
    depends_on: ["F-1012"],
    created_at: "2026-05-16T10:00:00-05:00",
    updated_at: "2026-05-18T09:00:00-05:00",
    body: body({
      why: "Claiming from the web UI could reduce context switching, but it needs a write API first.",
      success: "Clicking Claim updates the task file and refreshes queue state.",
      acceptance: [
        "The web action uses the same validation as the CLI.",
        "Failures leave the task file untouched.",
      ],
      notes: "Blocked on the write API task to show dependency-blocked work.",
    }),
  },
  {
    id: "F-1011",
    title: "Document demo workflow",
    status: "open",
    priority: "low",
    area: "docs",
    scope: ["README.md"],
    depends_on: ["F-1001"],
    created_at: "2026-05-16T15:15:00-05:00",
    updated_at: "2026-05-18T15:00:00-05:00",
    body: body({
      why: "The screenshot command should be easy to rediscover before a team update or product review.",
      success: "The docs include a short demo command and screenshot note.",
      acceptance: [
        "The docs mention that demo files are temporary.",
        "The docs explain how to stop the server.",
      ],
    }),
  },
  {
    id: "F-1012",
    title: "Define web write API boundary",
    status: "open",
    priority: "medium",
    area: "api",
    scope: ["packages/web/**", "packages/core/**"],
    depends_on: ["F-1008"],
    created_at: "2026-05-17T09:00:00-05:00",
    updated_at: "2026-05-18T13:20:00-05:00",
    body: body({
      why: "Write actions need a narrow API boundary so the browser cannot bypass task file validation.",
      success: "The web server exposes a minimal task mutation route backed by core write helpers.",
      acceptance: [
        "Only explicit lifecycle operations are supported.",
        "Invalid writes return structured errors.",
        "The API reuses existing task parsing and write helpers.",
      ],
    }),
  },
  {
    id: "F-1013",
    title: "Add first-run task creation prompt",
    status: "done",
    priority: "medium",
    area: "cli",
    scope: ["packages/cli/**"],
    created_at: "2026-05-08T10:00:00-05:00",
    updated_at: "2026-05-10T12:00:00-05:00",
    closed_at: "2026-05-10T12:00:00-05:00",
    close_reason: "CLI task creation now writes canonical Markdown.",
    body: body({
      why: "A repo needs a low-friction way to create the first useful task.",
      success: "The CLI can create canonical task Markdown with why, success, acceptance, and verification sections.",
      acceptance: [
        "Required frontmatter is valid.",
        "Markdown remains readable by humans.",
      ],
    }),
  },
  {
    id: "F-1014",
    title: "Review mobile screenshot layout",
    status: "blocked",
    priority: "low",
    area: "design",
    scope: ["packages/web/src/styles.css"],
    depends_on: ["F-1002"],
    created_at: "2026-05-17T14:40:00-05:00",
    updated_at: "2026-05-18T08:50:00-05:00",
    body: body({
      why: "A narrow viewport screenshot should still communicate the queue and selected task clearly.",
      success: "Mobile width preserves readable rows and keeps the detail pane reachable.",
      acceptance: [
        "No row text overlaps badges.",
        "The selected task title stays visible above the fold.",
      ],
    }),
  },
  {
    id: "F-1015",
    title: "Clean up stale demo sessions",
    status: "open",
    priority: "medium",
    area: "cli",
    scope: ["packages/cli/**"],
    depends_on: ["F-1004"],
    created_at: "2026-05-18T10:20:00-05:00",
    updated_at: "2026-05-18T16:10:00-05:00",
    body: body({
      why: "Demo servers should not leave confusing runtime state after a screenshot session.",
      success: "Stopping a demo server removes its session file and temporary repo.",
      acceptance: [
        "Graceful shutdown removes the temp repo.",
        "Session discovery ignores stale demo records.",
      ],
    }),
  },
];
