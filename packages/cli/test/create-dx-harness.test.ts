import { afterEach, describe, expect, test } from "bun:test";
import { loadTasks, type Task } from "@forge/core";
import {
  createForgeFixtureRepo,
  type ForgeFixtureRepo,
  type ForgeFixtureTask,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";

interface PlanTaskSpec {
  id: string;
  title: string;
  project: string;
  area: string;
  priority: "urgent" | "high" | "medium";
  scope: string[];
  depends_on?: string[];
  why: string;
  success: string;
  acceptance: string[];
  verification: string[];
  notes: string;
  plan: string;
}

interface RunResult {
  code: number;
  stdout: string[];
  stderr: string[];
}

const fixtureRepos: ForgeFixtureRepo[] = [];
const requiredSections = [
  "Why",
  "What success looks like",
  "Acceptance Criteria",
  "Execution Plan",
  "Verification",
  "Notes",
];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

describe("task creation DX dogfood harness", () => {
  test("compares structured Forge creation with direct Markdown authoring", async () => {
    const specs = realisticPlan();
    const structured = await createViaForgeCommands(specs);
    const direct = await createViaDirectMarkdown(specs);
    const comparison = compareCreationPaths(structured, direct);
    console.info(comparison.report);

    expect(structured.shape).toEqual(direct.shape);
    expect(structured.metrics).toMatchObject({
      commandCount: 6,
      followUpEdits: 3,
      operationCount: 6,
      taskCount: 3,
    });
    expect(direct.metrics).toMatchObject({
      commandCount: 0,
      followUpEdits: 0,
      operationCount: 1,
      taskCount: 3,
    });
    expect(structured.metrics.doctorDiagnostics).toBe(0);
    expect(structured.metrics.missingSectionCount).toBe(0);
    expect(direct.metrics.missingSectionCount).toBe(0);
    expect(comparison.limitations).toContain("execution_plan_requires_follow_up");
    expect(comparison.report).toContain("forge create loses one-step parity");
  });

  test("documents that create cannot accept a rich execution plan in one step", async () => {
    const repo = await makeRepo("forge-create-dx-inline-plan-");
    const result = await run(repo.repoRoot, [
      "create",
      "Inline execution plan",
      "--why",
      "The dogfood harness should expose current command gaps.",
      "--plan",
      "Summary: unsupported inline plan.",
      "--json",
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stderr.join("\n")).toContain("unknown create option: --plan");
  });
});

async function createViaForgeCommands(specs: PlanTaskSpec[]) {
  const repo = await makeRepo("forge-create-dx-structured-");
  let commandCount = 0;
  let followUpEdits = 0;

  for (const spec of specs) {
    expect(await run(repo.repoRoot, createArgs(spec))).toMatchObject({
      code: 0,
      stderr: [],
    });
    commandCount += 1;

    expect(await run(repo.repoRoot, ["plan", spec.id, "--stdin"], spec.plan)).toMatchObject({
      code: 0,
      stderr: [],
    });
    commandCount += 1;
    followUpEdits += 1;
  }

  const doctor = JSON.parse((await run(repo.repoRoot, ["doctor", "--json"])).stdout[0]);
  const tasks = await loadTasks(repo.repoRoot, { includeArchive: false });
  return {
    metrics: creationMetrics(tasks, {
      commandCount,
      doctorDiagnostics: doctor.summary.errors + doctor.summary.warnings,
      followUpEdits,
      operationCount: commandCount,
    }),
    shape: graphShape(tasks),
  };
}

async function createViaDirectMarkdown(specs: PlanTaskSpec[]) {
  const repo = await makeRepo("forge-create-dx-direct-");
  await repo.writeTasks(specs.map(toFixtureTask));

  const doctor = JSON.parse((await run(repo.repoRoot, ["doctor", "--json"])).stdout[0]);
  const tasks = await loadTasks(repo.repoRoot, { includeArchive: false });
  return {
    metrics: creationMetrics(tasks, {
      commandCount: 0,
      doctorDiagnostics: doctor.summary.errors + doctor.summary.warnings,
      followUpEdits: 0,
      operationCount: 1,
    }),
    shape: graphShape(tasks),
  };
}

function compareCreationPaths(
  structured: Awaited<ReturnType<typeof createViaForgeCommands>>,
  direct: Awaited<ReturnType<typeof createViaDirectMarkdown>>,
) {
  const limitations: string[] = [];
  if (structured.metrics.followUpEdits > direct.metrics.followUpEdits) {
    limitations.push("execution_plan_requires_follow_up");
  }

  return {
    limitations,
    report: [
      "forge create loses one-step parity when rich Execution Plan content is required.",
      `structured commands: ${structured.metrics.commandCount}`,
      `direct operations: ${direct.metrics.operationCount}`,
      `follow-up edits: ${structured.metrics.followUpEdits}`,
    ].join("\n"),
  };
}

function creationMetrics(
  tasks: Task[],
  input: {
    commandCount: number;
    doctorDiagnostics: number;
    followUpEdits: number;
    operationCount: number;
  },
) {
  return {
    ...input,
    missingSectionCount: tasks.reduce((count, task) => {
      return count + missingSections(task).length;
    }, 0),
    readabilityComplete: tasks.every((task) => missingSections(task).length === 0),
    taskCount: tasks.length,
  };
}

function createArgs(spec: PlanTaskSpec): string[] {
  return [
    "create",
    spec.id,
    "--title",
    spec.title,
    "--project",
    spec.project,
    "--area",
    spec.area,
    "--priority",
    spec.priority,
    "--scope",
    spec.scope[0],
    "--why",
    spec.why,
    "--success",
    spec.success,
    ...(spec.depends_on?.flatMap((id) => ["--depends-on", id]) ?? []),
    ...spec.acceptance.flatMap((item) => ["--acceptance", item]),
    ...spec.verification.flatMap((item) => ["--verification", item]),
    "--notes",
    spec.notes,
    "--json",
  ];
}

function toFixtureTask(spec: PlanTaskSpec): ForgeFixtureTask {
  return {
    id: spec.id,
    title: spec.title,
    area: spec.area,
    depends_on: spec.depends_on,
    priority: spec.priority,
    project: spec.project,
    scope: spec.scope,
    body: taskBody(spec),
  };
}

function taskBody(spec: PlanTaskSpec): string {
  return [
    `# ${spec.title}`,
    "",
    "## Why",
    "",
    spec.why,
    "",
    "## What success looks like",
    "",
    spec.success,
    "",
    "## Acceptance Criteria",
    "",
    ...spec.acceptance.map((item) => `- ${item}`),
    "",
    "## Execution Plan",
    "",
    spec.plan,
    "",
    "## Dependencies",
    "",
    spec.depends_on?.length ? `Tracked in frontmatter: ${spec.depends_on.join(", ")}.` : "None.",
    "",
    "## Verification",
    "",
    ...spec.verification.map((item) => `- ${item}`),
    "",
    "## Notes",
    "",
    spec.notes,
    "",
  ].join("\n");
}

function graphShape(tasks: Task[]) {
  return tasks
    .map((task) => ({
      area: task.area,
      depends_on: task.depends_on,
      id: task.id,
      priority: task.priority,
      project: task.project,
      scope: task.scope,
      title: task.title,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function missingSections(task: Task): string[] {
  return requiredSections.filter((section) => {
    return !new RegExp(`^## ${escapeRegExp(section)}\\s*$`, "m").test(task.body);
  });
}

function realisticPlan(): PlanTaskSpec[] {
  return [
    {
      id: "F-1001",
      title: "Add layout telemetry hooks",
      project: "forge",
      area: "web",
      priority: "urgent",
      scope: ["packages/web/**"],
      why: "Browser contracts need stable DOM hooks instead of screenshots.",
      success: "Header geometry can be measured by a deterministic harness.",
      acceptance: ["Selectors exist for header controls.", "No visible debug UI is added."],
      verification: ["bun run harness:web:layout"],
      notes: "Keep telemetry in production markup but invisible to users.",
      plan: "Summary: expose stable data-testid hooks for header layout elements.",
    },
    {
      id: "F-1002",
      title: "Add header layout contracts",
      project: "forge",
      area: "test",
      priority: "urgent",
      scope: ["packages/web/**"],
      depends_on: ["F-1001"],
      why: "Queue and Analytics can drift without browser-measured contracts.",
      success: "The harness fails when tabs leave the intended header lane.",
      acceptance: ["Desktop and narrow layouts are covered.", "Failures print rectangles."],
      verification: ["bun run harness:web:layout"],
      notes: "Measure rectangles; do not store screenshots.",
      plan: "Summary: encode the expected header lane through Playwright boxes.",
    },
    {
      id: "F-1003",
      title: "Fix header layout under contract",
      project: "forge",
      area: "web",
      priority: "high",
      scope: ["packages/web/**"],
      depends_on: ["F-1002"],
      why: "The visual fix should be driven by the contract that caught the drift.",
      success: "Queue and Analytics remain next to Worktree and Project controls.",
      acceptance: ["The red contract turns green.", "Keyboard shortcuts keep working."],
      verification: ["bun run harness:web", "bun run --cwd packages/web build"],
      notes: "Make the smallest layout change that satisfies the contract.",
      plan: "Summary: adjust topbar grid columns without redesigning the page.",
    },
  ];
}

async function makeRepo(prefix: string): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({ prefix });
  fixtureRepos.push(repo);
  return repo;
}

async function run(cwd: string, args: string[], stdin = ""): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    env: { USER: "harness" },
    now: new Date("2026-05-21T12:00:00Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    stdin: async () => stdin,
  });

  return { code, stdout, stderr };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
