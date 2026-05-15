#!/usr/bin/env bun
import {
  claimTaskFrom,
  completeTaskFrom,
  createTaskFrom,
  getReadyTasks,
  loadTasksFrom,
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
  "  forge claim <id> [--by <name>]",
  "  forge done <id>",
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
      case "claim":
        return await claim(cliOptions, rest);
      case "done":
        return await done(cliOptions, rest);
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

if (import.meta.main) {
  process.exit(await runCli(Bun.argv.slice(2)));
}
