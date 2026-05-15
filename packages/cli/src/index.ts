#!/usr/bin/env bun
import path from "node:path";
import {
  analyzeTasks,
  claimTaskFrom,
  completeTaskFrom,
  createTaskFrom,
  findParsedTaskByIdFrom,
  findForgeRoot,
  getReadyTasks,
  loadTasksFrom,
  rankReadyTaskQueue,
  rankReadyTasks,
  resolveGuidance,
  type CreateTaskInput,
  type GuidanceBundle,
  type GuidanceMatch,
  type RankedQueueEntry,
  type Task,
  type TaskGraphAnalysis,
  type TaskPriority,
} from "@forge/core";

export interface CliOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  now: Date;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

export type CommandClassification = "read" | "write" | "serve";

export interface CommandMetadata {
  name: string;
  usage: string;
  description: string;
  classification: CommandClassification;
  supportsJson: boolean;
  examples: string[];
  agentPurpose: string;
}

export const COMMANDS = [
  {
    name: "list",
    usage: "forge list",
    description: "List all task files.",
    classification: "read",
    supportsJson: false,
    examples: ["forge list"],
    agentPurpose: "Inspect repo task state.",
  },
  {
    name: "ready",
    usage: "forge ready",
    description: "List currently ready task files.",
    classification: "read",
    supportsJson: false,
    examples: ["forge ready"],
    agentPurpose: "Find work that can be claimed without robot JSON.",
  },
  {
    name: "queue",
    usage: "forge queue --json",
    description: "Emit the ranked ready queue.",
    classification: "read",
    supportsJson: true,
    examples: ["forge queue --json"],
    agentPurpose: "Inspect ranked work and graph diagnostics.",
  },
  {
    name: "next",
    usage: "forge next [--claim] [--by <name>] --json",
    description: "Return or claim the top ranked ready task.",
    classification: "write",
    supportsJson: true,
    examples: ["forge next --json", "forge next --claim --by codex --json"],
    agentPurpose: "Drive the execution loop by selecting the next task.",
  },
  {
    name: "show",
    usage: "forge show <id> --json",
    description: "Emit one task document.",
    classification: "read",
    supportsJson: true,
    examples: ["forge show F-0001 --json"],
    agentPurpose: "Load task context without parsing Markdown manually.",
  },
  {
    name: "blockers",
    usage: "forge blockers <id> --json",
    description: "Emit blockers for one task.",
    classification: "read",
    supportsJson: true,
    examples: ["forge blockers F-0001 --json"],
    agentPurpose: "Explain why a task is not ready.",
  },
  {
    name: "deps",
    usage: "forge deps <id> --json",
    description: "Emit direct dependencies and dependents.",
    classification: "read",
    supportsJson: true,
    examples: ["forge deps F-0001 --json"],
    agentPurpose: "Inspect local graph context.",
  },
  {
    name: "guidance",
    usage: "forge guidance [--json] [--for-task <id>] [--path <path>] [--full]",
    description: "Resolve contextual guidance.",
    classification: "read",
    supportsJson: true,
    examples: ["forge guidance", "forge guidance --for-task F-0001 --json"],
    agentPurpose: "Load repo, task, cwd, and path guidance for an agent step.",
  },
  {
    name: "create",
    usage: "forge create <id> --title <title> [options]",
    description: "Create a canonical task file.",
    classification: "write",
    supportsJson: false,
    examples: ['forge create F-0006 --title "Add task creation"'],
    agentPurpose: "Add planned work with the standard task shape.",
  },
  {
    name: "prompt",
    usage: "forge prompt <id|next>",
    description: "Emit a reusable task prompt.",
    classification: "read",
    supportsJson: false,
    examples: ["forge prompt next", "forge prompt F-0001"],
    agentPurpose: "Start an agent on a concrete task.",
  },
  {
    name: "loop-prompt",
    usage: "forge loop-prompt",
    description: "Emit the generic Forge execution loop prompt.",
    classification: "read",
    supportsJson: false,
    examples: ["forge loop-prompt"],
    agentPurpose: "Start an agent goal that keeps taking ready tasks.",
  },
  {
    name: "claim",
    usage: "forge claim <id> [--by <name>]",
    description: "Claim one task.",
    classification: "write",
    supportsJson: false,
    examples: ["forge claim F-0001 --by codex"],
    agentPurpose: "Reserve work before editing files.",
  },
  {
    name: "done",
    usage: "forge done <id>",
    description: "Mark one task done.",
    classification: "write",
    supportsJson: false,
    examples: ["forge done F-0001"],
    agentPurpose: "Close a task after verification.",
  },
  {
    name: "web",
    usage: "forge web [--host <host>] [--port <port>] [--dir <path>]",
    description: "Serve the local web viewer.",
    classification: "serve",
    supportsJson: false,
    examples: ["forge web", "forge web --dir /path/to/repo --port 5175"],
    agentPurpose: "Open a human review surface for the task graph.",
  },
] satisfies CommandMetadata[];

export type CommandName = (typeof COMMANDS)[number]["name"];

const USAGE = ["Usage:", ...COMMANDS.map((command) => `  ${command.usage}`)].join(
  "\n",
);

type CommandHandler = (options: CliOptions, args: string[]) => Promise<number>;

const COMMAND_HANDLERS = {
  list: listTasks,
  ready: listReadyTasks,
  queue,
  next,
  show,
  blockers,
  deps,
  guidance,
  create,
  prompt,
  "loop-prompt": loopPrompt,
  claim,
  done,
  web,
} satisfies Record<CommandName, CommandHandler>;

export async function runCli(
  args: string[],
  options: Partial<CliOptions> = {},
): Promise<number> {
  const cliOptions: CliOptions = {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    now: options.now ?? new Date(),
    stdout: options.stdout ?? ((message) => console.log(message)),
    stderr: options.stderr ?? ((message) => console.error(message)),
  };

  try {
    const [command, ...rest] = args;

    if (command === "-h" || command === "--help" || command === undefined) {
      cliOptions.stdout(USAGE);
      return command === undefined ? 1 : 0;
    }

    const handler = COMMAND_HANDLERS[command as CommandName];
    if (handler) {
      return await handler(cliOptions, rest);
    }

    cliOptions.stderr(`unknown command: ${command}\n\n${USAGE}`);
    return 1;
  } catch (error) {
    cliOptions.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function listTasks(options: CliOptions, args: string[]): Promise<number> {
  if (args.length > 0) {
    options.stderr("usage: forge list");
    return 1;
  }

  const tasks = await loadTasksFrom(options.cwd);
  writeTaskLines(options, tasks);
  return 0;
}

async function listReadyTasks(options: CliOptions, args: string[]): Promise<number> {
  if (args.length > 0) {
    options.stderr("usage: forge ready");
    return 1;
  }

  const tasks = await loadTasksFrom(options.cwd);
  writeTaskLines(options, getReadyTasks(tasks));
  return 0;
}

async function queue(options: CliOptions, args: string[]): Promise<number> {
  if (!isJsonOnly(args)) {
    return writeJsonUsageError(options, "usage: forge queue --json");
  }

  const repoRoot = await findForgeRoot(options.cwd);
  const tasks = await loadTasksFrom(repoRoot);
  const analysis = analyzeTasks(tasks);
  const entries = rankReadyTaskQueue(tasks);

  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      repoRoot,
      tasks: entries.map((entry) => toRobotQueueTask(entry.task, entry)),
      diagnostics: toRobotDiagnostics(analysis),
    }),
  );
  return 0;
}

async function next(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseNextArgs(args, options);
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  const repoRoot = await findForgeRoot(options.cwd);
  const tasks = await loadTasksFrom(repoRoot);
  const entry = rankReadyTaskQueue(tasks)[0];

  if (!entry) {
    options.stdout(
      stringifyJson({
        ok: true,
        version: 1,
        task: null,
        reason: "empty",
      }),
    );
    return 0;
  }

  if (!parsed.claim) {
    options.stdout(
      stringifyJson({
        ok: true,
        version: 1,
        task: toRobotQueueTask(entry.task, entry),
        reason: "ready",
      }),
    );
    return 0;
  }

  const claimedTask = await claimTaskFrom(repoRoot, entry.task.id, parsed.claimedBy, options.now);
  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      task: toRobotQueueTask(claimedTask, entry),
      reason: "claimed",
    }),
  );
  return 0;
}

async function show(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseIdJsonArgs(args, "usage: forge show <id> --json");
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  const tasks = await loadTasksFrom(options.cwd);
  const task = tasks.find((candidate) => candidate.id === parsed.taskId);
  if (!task) {
    return writeTaskNotFound(options, parsed.taskId);
  }

  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      task: {
        ...toRobotTaskSummary(task),
        kind: task.kind,
        parent: task.parent || null,
        created_at: task.created_at,
        updated_at: task.updated_at,
        closed_at: task.closed_at || null,
        close_reason: task.close_reason || null,
        sourcePath: task.sourcePath,
        body: task.body,
        sections: parseMarkdownSections(task.body),
      },
    }),
  );
  return 0;
}

async function blockers(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseIdJsonArgs(args, "usage: forge blockers <id> --json");
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  const tasks = await loadTasksFrom(options.cwd);
  const task = tasks.find((candidate) => candidate.id === parsed.taskId);
  if (!task) {
    return writeTaskNotFound(options, parsed.taskId);
  }

  const analysis = analyzeTasks(tasks);
  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      taskId: task.id,
      blockers: toRobotBlockers(task, analysis),
    }),
  );
  return 0;
}

async function deps(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseIdJsonArgs(args, "usage: forge deps <id> --json");
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  const tasks = await loadTasksFrom(options.cwd);
  const analysis = analyzeTasks(tasks);
  const task = analysis.tasksById.get(parsed.taskId);
  if (!task) {
    return writeTaskNotFound(options, parsed.taskId);
  }

  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      taskId: task.id,
      depends_on: task.depends_on.map((dependencyId) =>
        toDependencySummary(dependencyId, analysis.tasksById.get(dependencyId)),
      ),
      dependents: (analysis.dependentsById.get(task.id) ?? []).map((dependentId) =>
        toDependencySummary(dependentId, analysis.tasksById.get(dependentId)),
      ),
    }),
  );
  return 0;
}

async function guidance(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseGuidanceArgs(args);
  if (!parsed.ok) {
    if (parsed.json) {
      return writeJsonUsageError(options, parsed.message);
    }
    options.stderr(parsed.message);
    return 2;
  }

  try {
    const bundle = await resolveGuidance({
      cwd: options.cwd,
      taskId: parsed.taskId,
      paths: parsed.paths,
      includeContent: parsed.full,
    });

    if (parsed.json) {
      options.stdout(
        stringifyJson({
          ok: true,
          version: 1,
          ...toRobotGuidanceBundle(bundle),
        }),
      );
    } else {
      options.stdout(formatGuidanceText(bundle, parsed.full));
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const taskMatch = /^task (\S+) not found$/.exec(message);
    if (taskMatch) {
      if (parsed.json) {
        return writeTaskNotFound(options, taskMatch[1]);
      }
      options.stderr(message);
      return 3;
    }
    throw error;
  }
}

async function claim(options: CliOptions, args: string[]): Promise<number> {
  const { taskId, claimedBy } = parseClaimArgs(args, options);
  const task = await claimTaskFrom(options.cwd, taskId, claimedBy, options.now);
  options.stdout(`claimed ${task.id} by ${task.claimed_by}`);
  return 0;
}

async function create(options: CliOptions, args: string[]): Promise<number> {
  const input = parseCreateArgs(args);
  const task = await createTaskFrom(options.cwd, input, options.now);
  options.stdout(`created ${task.id} ${task.sourcePath}`);
  return 0;
}

async function prompt(options: CliOptions, args: string[]): Promise<number> {
  const [target, ...extra] = args;
  if (!target || extra.length > 0) {
    options.stderr("usage: forge prompt <id|next>");
    return 1;
  }

  const task =
    target === "next"
      ? await findNextPromptTask(options.cwd)
      : (await findParsedTaskByIdFrom(options.cwd, target)).task;

  if (!task) {
    options.stderr("no ready tasks");
    return 1;
  }

  options.stdout(formatAgentPrompt(task));
  return 0;
}

async function loopPrompt(options: CliOptions, args: string[]): Promise<number> {
  if (args.length > 0) {
    options.stderr("usage: forge loop-prompt");
    return 1;
  }

  options.stdout(formatLoopPrompt());
  return 0;
}

async function done(options: CliOptions, args: string[]): Promise<number> {
  const [taskId, ...extra] = args;
  if (!taskId || extra.length > 0) {
    options.stderr(`usage: forge done <id>`);
    return 1;
  }

  const task = await completeTaskFrom(options.cwd, taskId, options.now);
  options.stdout(`done ${task.id}`);
  return 0;
}

async function findNextPromptTask(cwd: string): Promise<Task | null> {
  const tasks = await loadTasksFrom(cwd);
  return rankReadyTasks(tasks)[0] ?? null;
}

async function web(options: CliOptions, args: string[]): Promise<number> {
  const webOptions = parseWebArgs(args, options.cwd);
  const repoRoot = await findForgeRoot(webOptions.startDir);
  const webPackageDir = path.resolve(import.meta.dir, "..", "..", "web");
  const url = `http://${webOptions.host}:${webOptions.port}/`;

  options.stdout(`serving ${repoRoot}`);
  options.stdout(url);

  const child = Bun.spawn(
    [
      "bun",
      "run",
      "dev",
      "--",
      "--host",
      webOptions.host,
      "--port",
      String(webOptions.port),
    ],
    {
      cwd: webPackageDir,
      env: {
        ...process.env,
        FORGE_START_DIR: repoRoot,
      },
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    },
  );

  return await child.exited;
}

function parseClaimArgs(
  args: string[],
  options: CliOptions,
): { taskId: string; claimedBy: string } {
  const [taskId, ...rest] = args;
  if (!taskId) {
    throw new Error("usage: forge claim <id> [--by <name>]");
  }

  let claimedBy = options.env.USER || "unknown";
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg !== "--by") {
      throw new Error(`unknown claim option: ${arg}`);
    }

    const value = rest[index + 1];
    if (!value) {
      throw new Error("claim option --by requires a value");
    }
    claimedBy = value;
    index += 1;
  }

  return { taskId, claimedBy };
}

function parseCreateArgs(args: string[]): CreateTaskInput {
  const [id, ...rest] = args;
  if (!id) {
    throw new Error("usage: forge create <id> --title <title> [options]");
  }

  const input: CreateTaskInput = { id, title: "" };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const value = rest[index + 1];
    if (!value) {
      throw new Error(`${arg} requires a value`);
    }

    switch (arg) {
      case "--title":
        input.title = value;
        break;
      case "--why":
        input.why = value;
        break;
      case "--success":
        input.success = value;
        break;
      case "--area":
        input.area = value;
        break;
      case "--priority":
        input.priority = parsePriority(value);
        break;
      case "--parent":
        input.parent = value;
        break;
      case "--scope":
        input.scope = [...(input.scope ?? []), value];
        break;
      case "--depends-on":
        input.depends_on = [...(input.depends_on ?? []), value];
        break;
      case "--acceptance":
        input.acceptance = [...(input.acceptance ?? []), value];
        break;
      case "--verification":
        input.verification = [...(input.verification ?? []), value];
        break;
      case "--notes":
        input.notes = value;
        break;
      default:
        throw new Error(`unknown create option: ${arg}`);
    }

    index += 1;
  }

  if (!input.title.trim()) {
    throw new Error("create requires --title <title>");
  }

  return input;
}

function parsePriority(value: string): TaskPriority {
  if (value === "urgent" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  throw new Error("priority must be one of: urgent, high, medium, low");
}

function isJsonOnly(args: string[]): boolean {
  return args.length === 1 && args[0] === "--json";
}

function parseIdJsonArgs(
  args: string[],
  usage: string,
): { ok: true; taskId: string } | { ok: false; message: string } {
  const [taskId, jsonFlag, ...extra] = args;
  if (!taskId || jsonFlag !== "--json" || extra.length > 0) {
    return { ok: false, message: usage };
  }
  return { ok: true, taskId };
}

function parseNextArgs(
  args: string[],
  options: CliOptions,
):
  | { ok: true; claim: false }
  | { ok: true; claim: true; claimedBy: string }
  | { ok: false; message: string } {
  let json = false;
  let claim = false;
  let claimedBy = options.env.USER || "unknown";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        json = true;
        break;
      case "--claim":
        claim = true;
        break;
      case "--by": {
        const value = args[index + 1];
        if (!value) {
          return { ok: false, message: "next option --by requires a value" };
        }
        claimedBy = value;
        index += 1;
        break;
      }
      default:
        return { ok: false, message: `unknown next option: ${arg}` };
    }
  }

  if (!json) {
    return { ok: false, message: "usage: forge next [--claim] [--by <name>] --json" };
  }

  if (!claim && args.includes("--by")) {
    return { ok: false, message: "next option --by requires --claim" };
  }

  return claim ? { ok: true, claim, claimedBy } : { ok: true, claim };
}

function parseGuidanceArgs(args: string[]):
  | { ok: true; json: boolean; full: boolean; taskId?: string; paths: string[] }
  | { ok: false; json: boolean; message: string } {
  let json = false;
  let full = false;
  let taskId: string | undefined;
  const paths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        json = true;
        break;
      case "--full":
        full = true;
        break;
      case "--for-task": {
        const value = args[index + 1];
        if (!value) {
          return { ok: false, json, message: "guidance option --for-task requires a value" };
        }
        taskId = value;
        index += 1;
        break;
      }
      case "--path": {
        const value = args[index + 1];
        if (!value) {
          return { ok: false, json, message: "guidance option --path requires a value" };
        }
        paths.push(value);
        index += 1;
        break;
      }
      default:
        return { ok: false, json, message: `unknown guidance option: ${arg}` };
    }
  }

  return { ok: true, json, full, taskId, paths };
}

function writeJsonUsageError(options: CliOptions, message: string): number {
  options.stderr(
    stringifyJson({
      ok: false,
      version: 1,
      error: {
        code: "usage_error",
        message,
        details: null,
      },
    }),
  );
  return 2;
}

function writeTaskNotFound(options: CliOptions, taskId: string): number {
  options.stderr(
    stringifyJson({
      ok: false,
      version: 1,
      error: {
        code: "task_not_found",
        message: `task ${taskId} not found`,
        details: { taskId },
      },
    }),
  );
  return 3;
}

function toRobotTaskSummary(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    area: task.area ?? null,
    claimed_by: task.claimed_by || null,
    scope: task.scope,
    depends_on: task.depends_on,
  };
}

function toRobotQueueTask(
  task: Task,
  entry: Pick<RankedQueueEntry, "rank" | "blockers" | "reasons">,
): Record<string, unknown> {
  return {
    ...toRobotTaskSummary(task),
    ready: task.status === "open" && !task.claimed_by && entry.blockers.length === 0,
    rank: entry.rank,
    blockers: entry.blockers,
    reasons: entry.reasons,
  };
}

function toRobotDiagnostics(analysis: TaskGraphAnalysis): Record<string, unknown> {
  return {
    missingDependencies: analysis.missingDependencies,
    dependencyCycles: analysis.dependencyCycles,
    duplicateTaskIds: analysis.duplicateTaskIds,
  };
}

function toRobotGuidanceBundle(bundle: GuidanceBundle): Record<string, unknown> {
  return {
    repoRoot: bundle.repoRoot,
    matches: bundle.matches.map((match) => ({
      path: match.path,
      sourcePath: match.sourcePath,
      reasons: match.reasons,
      promptSummary: match.promptSummary,
      ...(match.content === undefined ? {} : { content: match.content }),
    })),
    diagnostics: bundle.diagnostics,
  };
}

function formatGuidanceText(bundle: GuidanceBundle, full: boolean): string {
  if (bundle.matches.length === 0) {
    return "No guidance matched.";
  }

  return bundle.matches
    .map((match) => formatGuidanceMatchText(match, full))
    .join("\n\n");
}

function formatGuidanceMatchText(match: GuidanceMatch, full: boolean): string {
  const lines = [
    match.path,
    `reasons: ${match.reasons.join(", ")}`,
    "",
    full ? (match.content ?? "") : (match.promptSummary ?? "No prompt summary."),
  ];
  return lines.join("\n").trimEnd();
}

function toRobotBlockers(task: Task, analysis: TaskGraphAnalysis): Array<Record<string, unknown>> {
  const blockers: Array<Record<string, unknown>> = [];

  if (task.status !== "open") {
    blockers.push({
      kind: "status",
      message: `status is ${task.status}`,
      taskId: task.id,
    });
  }

  if (task.claimed_by.trim() !== "") {
    blockers.push({
      kind: "claim",
      message: `claimed by ${task.claimed_by}`,
      taskId: task.id,
    });
  }

  for (const diagnostic of analysis.duplicateTaskIds.filter(
    (candidate) => candidate.taskId === task.id,
  )) {
    blockers.push({
      kind: "duplicate_id",
      message: `duplicate task id ${task.id}`,
      taskId: task.id,
      sourcePaths: diagnostic.sourcePaths,
    });
  }

  for (const diagnostic of analysis.missingDependencies.filter(
    (candidate) => candidate.taskId === task.id,
  )) {
    blockers.push({
      kind: "missing_dependency",
      message: `missing dependency ${diagnostic.dependencyId}`,
      taskId: task.id,
      dependencyId: diagnostic.dependencyId,
    });
  }

  for (const dependencyId of task.depends_on) {
    const dependency = analysis.tasksById.get(dependencyId);
    if (!dependency || dependency.status === "done" || dependency.status === "canceled") {
      continue;
    }
    blockers.push({
      kind: "dependency_status",
      message: `dependency ${dependencyId} is ${dependency.status}`,
      taskId: task.id,
      dependencyId,
    });
  }

  for (const diagnostic of analysis.dependencyCycles.filter((candidate) =>
    candidate.taskIds.includes(task.id),
  )) {
    blockers.push({
      kind: "cycle",
      message: `dependency cycle: ${diagnostic.taskIds.join(" -> ")}`,
      taskId: task.id,
      taskIds: diagnostic.taskIds,
    });
  }

  return blockers;
}

function toDependencySummary(
  taskId: string,
  task: Task | undefined,
): Record<string, unknown> {
  return {
    id: taskId,
    title: task?.title ?? null,
    status: task?.status ?? null,
  };
}

function parseMarkdownSections(body: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  const headingPattern = /^##\s+(.+)$/gm;
  const matches = Array.from(body.matchAll(headingPattern));

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const title = match[1].trim();
    const start = match.index! + match[0].length;
    const end = nextMatch?.index ?? body.length;
    sections.push({ title, body: body.slice(start, end).trim() });
  }

  return sections;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseWebArgs(
  args: string[],
  defaultStartDir: string,
): { host: string; port: number; startDir: string } {
  const webOptions = {
    host: "127.0.0.1",
    port: 5174,
    startDir: defaultStartDir,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (!value) {
      throw new Error(`${arg} requires a value`);
    }

    switch (arg) {
      case "--host":
        webOptions.host = value;
        break;
      case "--port": {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error("web option --port requires a valid port");
        }
        webOptions.port = port;
        break;
      }
      case "--dir":
        webOptions.startDir = value;
        break;
      default:
        throw new Error(`unknown web option: ${arg}`);
    }

    index += 1;
  }

  return webOptions;
}

function writeTaskLines(options: CliOptions, tasks: Task[]): void {
  for (const task of tasks) {
    options.stdout(formatTaskLine(task));
  }
}

function formatTaskLine(task: Task): string {
  const fields = [task.id, task.status, task.claimed_by || "-"];
  if (task.area) {
    fields.push(task.area);
  }
  fields.push(task.title);
  return fields.join("\t");
}

function formatAgentPrompt(task: Task): string {
  const lines = [
    `Goal: Complete Forge task ${task.id} - ${task.title}`,
    "",
    "Follow the repository's AGENTS.md instructions and the Forge operating loop.",
    "Before editing code or docs, claim the task. Keep work inside the declared scope, update task notes with decisions and verification, and mark the task done only when acceptance criteria are satisfied.",
    "",
    `Task file: ${task.sourcePath}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Area: ${task.area ?? "-"}`,
    `Depends on: ${task.depends_on.length ? task.depends_on.join(", ") : "none"}`,
    "Scope:",
    ...task.scope.map((scope) => `- ${scope}`),
    "",
    "Task body:",
    task.body.trim(),
    "",
  ];

  return lines.join("\n");
}

function formatLoopPrompt(): string {
  return [
    "/goal Work the Forge execution loop until no ready task remains or a stop condition is hit.",
    "",
    "At the start of each iteration, use `forge prompt next` to select the current highest-ranked ready task. Claim it before editing. Follow the repository's AGENTS.md instructions and the Forge operating loop.",
    "",
    "For each task, keep edits inside the task scope. Update the task notes with decisions, blockers, and verification. Mark the task done only when its acceptance criteria are satisfied and concrete evidence supports completion. Commit the code and task-file updates together.",
    "",
    "After committing, start the next iteration with `forge prompt next` again.",
    "",
    "Stop when no task is ready, the selected task is ambiguous, required changes exceed scope, verification cannot run, or you need user judgment before continuing. Report the blocker plus the next input needed.",
  ].join("\n");
}

if (import.meta.main) {
  process.exit(await runCli(Bun.argv.slice(2)));
}
