#!/usr/bin/env bun
import path from "node:path";
import {
  analyzeTasks,
  addTaskDependencyFrom,
  appendTaskNoteFrom,
  blockTaskFrom,
  claimTaskFrom,
  completeTaskFrom,
  createTaskFrom,
  findParsedTaskByIdFrom,
  findForgeRoot,
  getReadyTasks,
  loadTasksFrom,
  rankReadyTaskQueue,
  rankReadyTasks,
  requestTaskReviewFrom,
  resolveGuidance,
  removeTaskDependencyFrom,
  unblockTaskFrom,
  upsertTaskExecutionPlanFrom,
  type CreateTaskInput,
  type Task,
  type TaskPriority,
  type TaskStatus,
  updateTaskFile,
} from "@forge/core";
import { COMMANDS, USAGE, type CommandName } from "./command-metadata";
import {
  isJsonOnly,
  parseClaimArgs,
  parseCreateArgs,
  parseDepsArgs,
  parseDoneArgs,
  parseGuidanceArgs,
  parseIdJsonArgs,
  parseReadyArgs,
  parseNextArgs,
  parseReasonCommandArgs,
  parseSetArgs,
  parseTaskListArgs,
  parseWebArgs,
  type LinkMode,
} from "./args";
import {
  getGraphDoctorDiagnostics,
  getGuidanceDoctorDiagnostics,
  getTaskCloseoutGuidance,
  inspectTaskStore,
} from "./doctor";
import { createDemoForgeRepo, type DemoForgeRepo } from "./demo-repo";
import { formatAgentPrompt, formatLoopPrompt } from "./prompt-format";
import {
  formatAgentHelp,
  formatGuidanceText,
  stringifyJson,
  toDependencySummary,
  toRobotBlockers,
  toRobotCommandMetadata,
  toRobotDiagnostics,
  toRobotGuidanceBundle,
  toRobotQueueTask,
  toRobotTaskDocument,
  toRobotTaskSummary,
} from "./robot";
import {
  discoverWebSession,
  removeWebSession,
  writeWebSession,
} from "./web-session";
import { findAvailablePort } from "./web-port";

export { COMMANDS } from "./command-metadata";
export type {
  CommandClassification,
  CommandMetadata,
  CommandWorkflow,
} from "./command-metadata";

export interface CliOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  now: Date;
  stdoutIsTTY: boolean;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  stdin: () => Promise<string>;
}

type CommandHandler = (options: CliOptions, args: string[]) => Promise<number>;

const COMMAND_HANDLERS = {
  commands,
  help,
  list: listTasks,
  ready: listReadyTasks,
  queue,
  next,
  show,
  blockers,
  deps,
  guidance,
  doctor,
  closeout,
  create,
  prompt,
  plan,
  "loop-prompt": loopPrompt,
  claim,
  note,
  block,
  unblock,
  review,
  set,
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
    stdoutIsTTY: options.stdoutIsTTY ?? process.stdout.isTTY === true,
    stdout: options.stdout ?? ((message) => console.log(message)),
    stderr: options.stderr ?? ((message) => console.error(message)),
    stdin: options.stdin ?? (() => Bun.stdin.text()),
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

async function commands(options: CliOptions, args: string[]): Promise<number> {
  if (!isJsonOnly(args)) {
    return writeJsonUsageError(options, "usage: forge commands --json");
  }

  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      commands: COMMANDS.map(toRobotCommandMetadata),
    }),
  );
  return 0;
}

async function help(options: CliOptions, args: string[]): Promise<number> {
  if (args.length !== 1 || args[0] !== "--agent") {
    options.stderr("usage: forge help --agent");
    return 1;
  }

  options.stdout(formatAgentHelp());
  return 0;
}

async function listTasks(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseTaskListArgs(args);
  if (!parsed) {
    options.stderr("usage: forge list [--all|--closed] [--links=auto|always|never]");
    return 1;
  }

  const repoRoot = await findForgeRoot(options.cwd);
  const tasks = await loadTasksFrom(repoRoot);
  const linkBaseUrl = await getTaskLinkBaseUrl(options, repoRoot, parsed.links);
  writeTaskLines(options, filterListTasks(tasks, parsed.mode), linkBaseUrl);
  return 0;
}

async function listReadyTasks(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseReadyArgs(args);
  if (!parsed) {
    options.stderr("usage: forge ready [--links=auto|always|never]");
    return 1;
  }

  const repoRoot = await findForgeRoot(options.cwd);
  const tasks = await loadTasksFrom(repoRoot);
  const linkBaseUrl = await getTaskLinkBaseUrl(options, repoRoot, parsed.links);
  writeTaskLines(options, getReadyTasks(tasks), linkBaseUrl);
  return 0;
}

function filterListTasks(tasks: Task[], mode: "active" | "all" | "closed"): Task[] {
  if (mode === "all") {
    return tasks;
  }
  if (mode === "closed") {
    return tasks.filter(isClosedTask);
  }
  return tasks.filter((task) => !isClosedTask(task));
}

function isClosedTask(task: Task): boolean {
  return task.status === "done" || task.status === "canceled";
}

function parsePromptArgs(args: string[]): { ok: true; target: string; full: boolean } | { ok: false; message: string } {
  const usage = "usage: forge prompt <id|next> [--full]";
  if (args.length === 0 || args.length > 2) {
    return { ok: false, message: usage };
  }

  const [target, option] = args;
  if (!target || target === "--full") {
    return { ok: false, message: usage };
  }
  if (option !== undefined && option !== "--full") {
    return { ok: false, message: usage };
  }

  return { ok: true, target, full: option === "--full" };
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
      task: toRobotTaskDocument(task),
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
  const parsed = parseDepsArgs(args);
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  if (parsed.action !== "show") {
    try {
      const result =
        parsed.action === "add"
          ? await addTaskDependencyFrom(
              options.cwd,
              parsed.taskId,
              parsed.dependencyId,
              options.now,
            )
          : await removeTaskDependencyFrom(
              options.cwd,
              parsed.taskId,
              parsed.dependencyId,
              options.now,
            );
      options.stdout(
        stringifyJson({
          ok: true,
          version: 1,
          action: parsed.action,
          changed: result.changed,
          reason: result.reason,
          task: toRobotTaskDocument(result.task),
        }),
      );
      return 0;
    } catch (error) {
      return writeDependencyEditError(options, error);
    }
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

async function doctor(options: CliOptions, args: string[]): Promise<number> {
  if (!isJsonOnly(args)) {
    return writeJsonUsageError(options, "usage: forge doctor --json");
  }

  const repoRoot = await findForgeRoot(options.cwd);
  const { tasks, diagnostics } = await inspectTaskStore(repoRoot);
  diagnostics.push(...(await getGuidanceDoctorDiagnostics(repoRoot)));

  if (tasks.length > 0) {
    diagnostics.push(...getGraphDoctorDiagnostics(analyzeTasks(tasks)));
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      summary: {
        errors,
        warnings: diagnostics.length - errors,
      },
      diagnostics,
    }),
  );
  return errors === 0 ? 0 : 4;
}

async function closeout(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseIdJsonArgs(args, "usage: forge closeout <id> --json");
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  const repoRoot = await findForgeRoot(options.cwd);
  let task: Task;
  try {
    task = (await findParsedTaskByIdFrom(repoRoot, parsed.taskId)).task;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const taskMatch = /^task (\S+) not found$/.exec(message);
    if (taskMatch) {
      return writeTaskNotFound(options, taskMatch[1]);
    }
    throw error;
  }
  const guidance = await getTaskCloseoutGuidance(repoRoot, task);

  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      taskId: task.id,
      closeout: guidance,
    }),
  );
  return 0;
}

async function claim(options: CliOptions, args: string[]): Promise<number> {
  const { taskId, claimedBy } = parseClaimArgs(args, options);
  const task = await claimTaskFrom(options.cwd, taskId, claimedBy, options.now);
  options.stdout(`claimed ${task.id} by ${task.claimed_by}`);
  return 0;
}

async function note(options: CliOptions, args: string[]): Promise<number> {
  const [taskId, stdinFlag, ...extra] = args;
  if (!taskId || stdinFlag !== "--stdin" || extra.length > 0) {
    options.stderr("usage: forge note <id> --stdin");
    return 1;
  }

  const task = await appendTaskNoteFrom(options.cwd, taskId, await options.stdin(), options.now);
  options.stdout(`noted ${task.id}`);
  return 0;
}

async function block(options: CliOptions, args: string[]): Promise<number> {
  const { taskId, reason } = parseReasonCommandArgs(
    args,
    "usage: forge block <id> --reason <text>",
  );
  const task = await blockTaskFrom(options.cwd, taskId, reason, options.now);
  options.stdout(`blocked ${task.id}`);
  return 0;
}

async function unblock(options: CliOptions, args: string[]): Promise<number> {
  const [taskId, ...extra] = args;
  if (!taskId || extra.length > 0) {
    options.stderr("usage: forge unblock <id>");
    return 1;
  }

  const task = await unblockTaskFrom(options.cwd, taskId, options.now);
  options.stdout(`unblocked ${task.id}`);
  return 0;
}

async function review(options: CliOptions, args: string[]): Promise<number> {
  const { taskId, reason } = parseReasonCommandArgs(
    args,
    "usage: forge review <id> --reason <text>",
  );
  const task = await requestTaskReviewFrom(options.cwd, taskId, reason, options.now);
  options.stdout(`review requested ${task.id}`);
  return 0;
}

async function set(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseSetArgs(args);
  if (!parsed.ok) {
    return writeJsonUsageError(options, parsed.message);
  }

  const existing = await findParsedTaskByIdFrom(options.cwd, parsed.taskId);
  const task = await updateTaskFile(existing.task.sourcePath, {
    ...parsed.updates,
    updated_at: options.now.toISOString(),
  });

  options.stdout(
    stringifyJson({
      ok: true,
      version: 1,
      task: toRobotTaskDocument(task),
    }),
  );
  return 0;
}

async function create(options: CliOptions, args: string[]): Promise<number> {
  const input = parseCreateArgs(args);
  const task = await createTaskFrom(options.cwd, input, options.now);
  options.stdout(`created ${task.id} ${task.sourcePath}`);
  return 0;
}

async function prompt(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parsePromptArgs(args);
  if (!parsed.ok) {
    options.stderr(parsed.message);
    return 1;
  }

  const task =
    parsed.target === "next"
      ? await findNextPromptTask(options.cwd)
      : (await findParsedTaskByIdFrom(options.cwd, parsed.target)).task;

  if (!task) {
    options.stderr("no ready tasks");
    return 1;
  }

  const guidance = await resolveGuidance({
    cwd: options.cwd,
    taskId: task.id,
    includeContent: parsed.full,
  });

  options.stdout(formatAgentPrompt(task, guidance, parsed.full));
  return 0;
}

async function plan(options: CliOptions, args: string[]): Promise<number> {
  const [target, stdinFlag, ...extra] = args;
  if (!target || stdinFlag !== "--stdin" || extra.length > 0) {
    options.stderr("usage: forge plan <id|next> --stdin");
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

  const updated = await upsertTaskExecutionPlanFrom(
    options.cwd,
    task.id,
    await options.stdin(),
    options.now,
  );
  options.stdout(`planned ${updated.id}`);
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
  const parsed = parseDoneArgs(args);
  if (!parsed.ok) {
    options.stderr(parsed.message);
    return 1;
  }

  const task = await completeTaskFrom(options.cwd, parsed.taskId, options.now, parsed.reason);
  if (parsed.json) {
    options.stdout(
      stringifyJson({
        ok: true,
        version: 1,
        task: {
          ...toRobotTaskSummary(task),
          closed_at: task.closed_at ?? null,
          close_reason: task.close_reason ?? null,
        },
      }),
    );
    return 0;
  }

  options.stdout(`done ${task.id}`);
  return 0;
}

async function findNextPromptTask(cwd: string): Promise<Task | null> {
  const tasks = await loadTasksFrom(cwd);
  return rankReadyTasks(tasks)[0] ?? null;
}

async function web(options: CliOptions, args: string[]): Promise<number> {
  const webOptions = parseWebArgs(args, options.cwd);
  if (webOptions.action === "status") {
    const repoRoot = await findForgeRoot(webOptions.startDir);
    options.stdout(
      stringifyJson({
        ok: true,
        version: 1,
        repoRoot,
        session: await discoverWebSession(repoRoot, options.env),
      }),
    );
    return 0;
  }

  let demoRepo: DemoForgeRepo | null = null;
  const repoRoot = webOptions.demo
    ? (demoRepo = await createDemoForgeRepo()).repoRoot
    : await findForgeRoot(webOptions.startDir);
  const webPackageDir = path.resolve(import.meta.dir, "..", "..", "web");
  const actualPort = await findAvailablePort(webOptions.host, webOptions.port);
  const url = `http://${webOptions.host}:${actualPort}/`;

  options.stdout(`${webOptions.demo ? "serving demo" : "serving"} ${repoRoot}`);
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
      String(actualPort),
      "--strictPort",
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
  await writeWebSession(repoRoot, {
    host: webOptions.host,
    port: actualPort,
    pid: child.pid,
    startedAt: options.now.toISOString(),
  });

  const stopChild = () => {
    child.kill("SIGTERM");
  };
  process.once("SIGINT", stopChild);
  process.once("SIGTERM", stopChild);

  try {
    return await child.exited;
  } finally {
    process.off("SIGINT", stopChild);
    process.off("SIGTERM", stopChild);
    await removeWebSession(repoRoot, child.pid);
    await demoRepo?.cleanup();
  }
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

function writeDependencyEditError(options: CliOptions, error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const taskMatch = /^task (\S+) not found$/.exec(message);
  if (taskMatch) {
    return writeTaskNotFound(options, taskMatch[1]);
  }

  if (message.startsWith("dependency edit would create a cycle:")) {
    options.stderr(
      stringifyJson({
        ok: false,
        version: 1,
        error: {
          code: "dependency_cycle",
          message,
          details: null,
        },
      }),
    );
    return 4;
  }

  options.stderr(
    stringifyJson({
      ok: false,
      version: 1,
      error: {
        code: "dependency_edit_failed",
        message,
        details: null,
      },
    }),
  );
  return 1;
}

function writeTaskLines(options: CliOptions, tasks: Task[], linkBaseUrl: string | null): void {
  for (const task of tasks) {
    options.stdout(formatTaskLine(task, linkBaseUrl));
  }
}

function formatTaskLine(task: Task, linkBaseUrl: string | null): string {
  const fields = [formatTaskId(task.id, linkBaseUrl), task.status, task.claimed_by || "-"];
  if (task.area) {
    fields.push(task.area);
  }
  fields.push(task.title);
  return fields.join("\t");
}

async function getTaskLinkBaseUrl(
  options: CliOptions,
  repoRoot: string,
  mode: LinkMode,
): Promise<string | null> {
  if (mode === "never" || (mode === "auto" && !options.stdoutIsTTY)) {
    return null;
  }
  return (await discoverWebSession(repoRoot, options.env))?.baseUrl ?? null;
}

function formatTaskId(taskId: string, linkBaseUrl: string | null): string {
  if (!linkBaseUrl) {
    return taskId;
  }
  const url = new URL(linkBaseUrl);
  url.searchParams.set("task", taskId);
  return `\u001B]8;;${url.toString()}\u0007${taskId}\u001B]8;;\u0007`;
}

if (import.meta.main) {
  process.exit(await runCli(Bun.argv.slice(2)));
}
