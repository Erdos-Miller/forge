#!/usr/bin/env bun
import path from "node:path";
import {
  claimTaskFrom,
  completeTaskFrom,
  createTaskFrom,
  findParsedTaskByIdFrom,
  findForgeRoot,
  getReadyTasks,
  loadTasksFrom,
  rankReadyTasks,
  type CreateTaskInput,
  type Task,
  type TaskPriority,
} from "@forge/core";

export interface CliOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  now: Date;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

const USAGE = [
  "Usage:",
  "  forge list",
  "  forge ready",
  "  forge create <id> --title <title> [options]",
  "  forge prompt <id|next>",
  "  forge loop-prompt",
  "  forge claim <id> [--by <name>]",
  "  forge done <id>",
  "  forge web [--host <host>] [--port <port>] [--dir <path>]",
].join("\n");

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

    switch (command) {
      case "list":
        return await listTasks(cliOptions, rest);
      case "ready":
        return await listReadyTasks(cliOptions, rest);
      case "create":
        return await create(cliOptions, rest);
      case "prompt":
        return await prompt(cliOptions, rest);
      case "loop-prompt":
        return await loopPrompt(cliOptions, rest);
      case "claim":
        return await claim(cliOptions, rest);
      case "done":
        return await done(cliOptions, rest);
      case "web":
        return await web(cliOptions, rest);
      case "-h":
      case "--help":
      case undefined:
        cliOptions.stdout(USAGE);
        return command === undefined ? 1 : 0;
      default:
        cliOptions.stderr(`unknown command: ${command}\n\n${USAGE}`);
        return 1;
    }
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
