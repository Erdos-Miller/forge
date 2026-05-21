import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TaskPriority, TaskStatus } from "../src";

export interface ForgeFixtureTask {
  id: string;
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  claimed_by?: string;
  depends_on?: string[];
  project?: string;
  area?: string;
  scope?: string[];
  body?: string;
  closed_at?: string;
  close_reason?: string;
  includeOptionalFields?: boolean;
}

export interface ForgeFixtureRepo {
  repoRoot: string;
  tasksDir: string;
  nestedDir: string;
  writeTask: (task: ForgeFixtureTask) => Promise<string>;
  writeTasks: (tasks: ForgeFixtureTask[], batchSize?: number) => Promise<void>;
  cleanup: () => Promise<void>;
}

export interface MalformedForgeFixtureFile {
  filename: string;
  contents: string;
}

interface CreateForgeFixtureRepoOptions {
  prefix?: string;
  repoRoot?: string;
  tasks?: ForgeFixtureTask[];
  nestedPath?: string[];
  malformedFiles?: MalformedForgeFixtureFile[];
}

export async function createForgeFixtureRepo(
  options: CreateForgeFixtureRepoOptions = {},
): Promise<ForgeFixtureRepo> {
  const repoRoot = options.repoRoot
    ? path.resolve(options.repoRoot)
    : await fs.mkdtemp(path.join(os.tmpdir(), options.prefix ?? "forge-fixture-"));
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const nestedDir = path.join(repoRoot, ...(options.nestedPath ?? ["packages", "core", "src"]));
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });

  const fixtureRepo: ForgeFixtureRepo = {
    repoRoot,
    tasksDir,
    nestedDir,
    writeTask: async (task) => writeForgeFixtureTask(tasksDir, task),
    writeTasks: async (tasks, batchSize = 200) => {
      for (let index = 0; index < tasks.length; index += batchSize) {
        await Promise.all(
          tasks.slice(index, index + batchSize).map((task) => writeForgeFixtureTask(tasksDir, task)),
        );
      }
    },
    cleanup: async () => fs.rm(repoRoot, { recursive: true, force: true }),
  };

  if (options.tasks) {
    await fixtureRepo.writeTasks(options.tasks);
  }
  if (options.malformedFiles) {
    await Promise.all(
      options.malformedFiles.map((file) =>
        writeMalformedForgeFixtureTask(tasksDir, file.filename, file.contents),
      ),
    );
  }

  return fixtureRepo;
}

export interface ForgeFixtureWorkspaceRootOptions {
  name?: string;
  tasks?: ForgeFixtureTask[];
  nestedPath?: string[];
  malformedFiles?: MalformedForgeFixtureFile[];
}

export interface ForgeFixtureWorkspace {
  workspaceRoot: string;
  roots: ForgeFixtureRepo[];
  ignoredRoots: string[];
  writeRoot: (options?: ForgeFixtureWorkspaceRootOptions) => Promise<ForgeFixtureRepo>;
  writeIgnoredRoot: (relativePath: string[], tasks?: ForgeFixtureTask[]) => Promise<string>;
  cleanup: () => Promise<void>;
}

interface CreateForgeFixtureWorkspaceOptions {
  prefix?: string;
  roots?: ForgeFixtureWorkspaceRootOptions[];
}

export async function createForgeFixtureWorkspace(
  options: CreateForgeFixtureWorkspaceOptions = {},
): Promise<ForgeFixtureWorkspace> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), options.prefix ?? "forge-workspace-fixture-"),
  );
  const roots: ForgeFixtureRepo[] = [];
  const ignoredRoots: string[] = [];

  const workspace: ForgeFixtureWorkspace = {
    workspaceRoot,
    roots,
    ignoredRoots,
    writeRoot: async (rootOptions = {}) => {
      const rootName = rootOptions.name ?? `repo-${roots.length + 1}`;
      const repo = await createForgeFixtureRepo({
        ...rootOptions,
        repoRoot: path.join(workspaceRoot, rootName),
      });
      roots.push(repo);
      return repo;
    },
    writeIgnoredRoot: async (relativePath, tasks = minimalForgeFixtureTasks()) => {
      const ignoredRoot = path.join(workspaceRoot, ...relativePath);
      const repo = await createForgeFixtureRepo({ repoRoot: ignoredRoot, tasks });
      ignoredRoots.push(repo.repoRoot);
      return repo.repoRoot;
    },
    cleanup: async () => fs.rm(workspaceRoot, { recursive: true, force: true }),
  };

  for (const root of options.roots ?? []) {
    await workspace.writeRoot(root);
  }

  return workspace;
}

export async function writeForgeFixtureTask(
  tasksDir: string,
  task: ForgeFixtureTask,
): Promise<string> {
  const filePath = path.join(tasksDir, `${task.id}-${slugify(task.title ?? task.id)}.md`);
  await fs.writeFile(filePath, createForgeFixtureTaskFile(task));
  return filePath;
}

export async function writeMalformedForgeFixtureTask(
  tasksDir: string,
  filename: string,
  contents = "---\nid: [\n---\n",
): Promise<string> {
  const filePath = path.join(tasksDir, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
  return filePath;
}

export function createForgeFixtureTaskFile(task: ForgeFixtureTask): string {
  const title = task.title ?? task.id;
  const status = task.status ?? "open";
  const includeOptionalFields = task.includeOptionalFields ?? true;
  const closedFields = getClosedFields(task, status, includeOptionalFields);

  return [
    "---",
    `id: ${task.id}`,
    `title: ${JSON.stringify(title)}`,
    "kind: task",
    `status: ${status}`,
    `priority: ${task.priority ?? "medium"}`,
    ...(task.project ? [`project: ${JSON.stringify(task.project)}`] : []),
    'parent: ""',
    `depends_on:${formatList(task.depends_on ?? [])}`,
    `claimed_by: ${JSON.stringify(task.claimed_by ?? "")}`,
    `area: ${task.area ?? "harness"}`,
    "scope:",
    ...(task.scope ?? ["packages/**"]).map((entry) => `  - ${JSON.stringify(entry)}`),
    "created_at: 2026-05-15T00:00:00-05:00",
    "updated_at: 2026-05-15T00:00:00-05:00",
    ...closedFields,
    ...(includeOptionalFields ? ['blocked_reason: ""', 'review_reason: ""'] : []),
    "---",
    "",
    task.body ?? fixtureTaskBody(title),
  ].join("\n");
}

function fixtureTaskBody(title: string): string {
  return [
    `# ${title}`,
    "",
    "## Why",
    "",
    "Fixture tasks should exercise normal Forge task shape.",
    "",
    "## What success looks like",
    "",
    "The fixture remains parseable and useful in doctor tests.",
    "",
    "## Acceptance Criteria",
    "",
    "- The task has expected Markdown fields.",
    "",
    "## Verification",
    "",
    "- bun test",
    "",
    "## Notes",
    "",
    "Harness fixture.",
    "",
  ].join("\n");
}

export function minimalForgeFixtureTasks(): ForgeFixtureTask[] {
  return [{ id: "F-0001", title: "Minimal ready task", priority: "high" }];
}

export function blockedForgeFixtureTasks(): ForgeFixtureTask[] {
  return [
    { id: "F-0101", title: "Blocking task", priority: "high" },
    { id: "F-0102", title: "Blocked task", priority: "high", depends_on: ["F-0101"] },
  ];
}

export function claimedForgeFixtureTasks(): ForgeFixtureTask[] {
  return [
    {
      id: "F-0201",
      title: "Claimed task",
      priority: "high",
      claimed_by: "codex",
      body: plannedBody("Claimed task"),
    },
  ];
}

export function doneForgeFixtureTasks(): ForgeFixtureTask[] {
  return [
    {
      id: "F-0301",
      title: "Done task",
      status: "done",
      priority: "medium",
      closed_at: "2026-05-15T01:00:00-05:00",
      close_reason: "Fixture completed",
    },
  ];
}

export function legacyForgeFixtureTasks(): ForgeFixtureTask[] {
  return [
    {
      id: "F-0401",
      title: "Legacy optional fields",
      includeOptionalFields: false,
      scope: ["packages/web/**"],
    },
  ];
}

export function scaleForgeFixtureTasks(count: number): ForgeFixtureTask[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `F-${String(index + 1).padStart(5, "0")}`;
    return {
      id,
      title: `Harness task ${index + 1}`,
      priority: index % 4 === 0 ? "urgent" : index % 4 === 1 ? "high" : index % 4 === 2 ? "medium" : "low",
    };
  });
}

function getClosedFields(
  task: ForgeFixtureTask,
  status: TaskStatus,
  includeOptionalFields: boolean,
): string[] {
  if (!includeOptionalFields) return [];

  if (status === "done" || status === "canceled") {
    return [
      `closed_at: ${task.closed_at ?? "2026-05-15T01:00:00-05:00"}`,
      `close_reason: ${JSON.stringify(task.close_reason ?? "Fixture closed")}`,
    ];
  }

  return ['closed_at: ""', 'close_reason: ""'];
}

export function plannedBody(title: string): string {
  return [
    `# ${title}`,
    "",
    "## Why",
    "",
    "The fixture needs enough context for doctor checks.",
    "",
    "## What success looks like",
    "",
    "The planned fixture has a complete task brief.",
    "",
    "## Acceptance Criteria",
    "",
    "- The task includes an execution plan and expected fields.",
    "",
    "## Execution Plan",
    "",
    "Summary: Fixture task has a plan.",
    "",
    "## Verification",
    "",
    "- bun test",
    "",
    "## Notes",
    "",
    "Planned fixture.",
    "",
  ].join("\n");
}

function formatList(values: string[]): string {
  if (values.length === 0) return " []";
  return "\n" + values.map((value) => `  - ${JSON.stringify(value)}`).join("\n");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
