import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
} from "@forge/core";
import type { CliOptions } from "./index";

const SET_USAGE =
  "usage: forge set <id> [--priority <value>] [--status <value>] " +
  "[--area <value>] [--scope <glob>] [--closed-at <timestamp>] " +
  "[--close-reason <text>] --json";

export function parseClaimArgs(
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

export type LinkMode = "auto" | "always" | "never";

export interface TaskListArgs {
  mode: "active" | "all" | "closed";
  links: LinkMode;
}

export function parseTaskListArgs(args: string[]): TaskListArgs | null {
  let mode: TaskListArgs["mode"] = "active";
  let links: LinkMode = "auto";

  for (const arg of args) {
    if (arg === "--all") {
      if (mode === "closed") {
        return null;
      }
      mode = "all";
      continue;
    }
    if (arg === "--closed") {
      if (mode === "all") {
        return null;
      }
      mode = "closed";
      continue;
    }
    if (arg.startsWith("--links=")) {
      const parsed = parseLinkMode(arg.slice("--links=".length));
      if (!parsed) {
        return null;
      }
      links = parsed;
      continue;
    }
    return null;
  }

  return { mode, links };
}

export function parseReadyArgs(args: string[]): { links: LinkMode } | null {
  let links: LinkMode = "auto";

  for (const arg of args) {
    if (!arg.startsWith("--links=")) {
      return null;
    }
    const parsed = parseLinkMode(arg.slice("--links=".length));
    if (!parsed) {
      return null;
    }
    links = parsed;
  }

  return { links };
}

export function parseWorktreeStatusArgs(
  args: string[],
): { ok: true; taskId: string | null } | { ok: false; message: string } {
  let json = false;
  let taskId: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--task") {
      const value = args[index + 1];
      if (!value) {
        return { ok: false, message: "worktree-status option --task requires a value" };
      }
      taskId = value;
      index += 1;
      continue;
    }
    return { ok: false, message: WORKTREE_STATUS_USAGE };
  }

  return json ? { ok: true, taskId } : { ok: false, message: WORKTREE_STATUS_USAGE };
}

function parseLinkMode(value: string): LinkMode | null {
  if (value === "auto" || value === "always" || value === "never") {
    return value;
  }
  return null;
}

export function parseReasonCommandArgs(
  args: string[],
  usage: string,
): { taskId: string; reason: string } {
  const [taskId, reasonFlag, reason, ...extra] = args;
  if (!taskId || reasonFlag !== "--reason" || !reason || extra.length > 0) {
    throw new Error(usage);
  }
  return { taskId, reason };
}

export function parseDoneArgs(
  args: string[],
): { ok: true; taskId: string; reason: string; json: boolean } | { ok: false; message: string } {
  const [taskId, ...rest] = args;
  if (!taskId) {
    return { ok: false, message: "usage: forge done <id> [--reason <text>] [--json]" };
  }

  let reason = "";
  let json = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    switch (arg) {
      case "--reason": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "done option --reason requires a value" };
        }
        reason = value;
        index += 1;
        break;
      }
      case "--json":
        json = true;
        break;
      default:
        return { ok: false, message: `unknown done option: ${arg}` };
    }
  }

  return { ok: true, taskId, reason, json };
}

export function parseSetArgs(args: string[]):
  | {
      ok: true;
      taskId: string;
      updates: Partial<
        Pick<Task, "priority" | "status" | "area" | "scope" | "closed_at" | "close_reason">
      >;
    }
  | { ok: false; message: string } {
  const [taskId, ...rest] = args;
  if (!taskId) {
    return {
      ok: false,
      message: SET_USAGE,
    };
  }

  let json = false;
  const updates: Partial<
    Pick<Task, "priority" | "status" | "area" | "scope" | "closed_at" | "close_reason">
  > = {};
  const scopes: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    switch (arg) {
      case "--json":
        json = true;
        break;
      case "--priority": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "set option --priority requires a value" };
        }
        try {
          updates.priority = parsePriority(value);
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
        index += 1;
        break;
      }
      case "--status": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "set option --status requires a value" };
        }
        try {
          updates.status = parseStatus(value);
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
        index += 1;
        break;
      }
      case "--area": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "set option --area requires a value" };
        }
        updates.area = value;
        index += 1;
        break;
      }
      case "--scope": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "set option --scope requires a value" };
        }
        scopes.push(value);
        index += 1;
        break;
      }
      case "--closed-at": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "set option --closed-at requires a value" };
        }
        if (Number.isNaN(Date.parse(value))) {
          return { ok: false, message: "closed_at must be a parseable timestamp" };
        }
        updates.closed_at = value;
        index += 1;
        break;
      }
      case "--close-reason": {
        const value = rest[index + 1];
        if (!value) {
          return { ok: false, message: "set option --close-reason requires a value" };
        }
        updates.close_reason = value;
        index += 1;
        break;
      }
      default:
        return { ok: false, message: `unknown set option: ${arg}` };
    }
  }

  if (!json) {
    return {
      ok: false,
      message: SET_USAGE,
    };
  }
  if (scopes.length > 0) {
    updates.scope = scopes;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, message: "set requires at least one field to update" };
  }

  return { ok: true, taskId, updates };
}

export function parseCreateArgs(args: string[]): CreateTaskInput {
  const [id, ...rest] = args;
  if (!id) {
    throw new Error(CREATE_USAGE);
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

export const CREATE_USAGE =
  "usage: forge create <id> --title <title> " +
  "[--why <text>] [--success <text>] [--acceptance <text>] " +
  "[--verification <text>] [--notes <text>] [options]";

export const WORKTREE_STATUS_USAGE =
  "usage: forge worktree-status --json [--task <id>]";

function parsePriority(value: string): TaskPriority {
  if (value === "urgent" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  throw new Error("priority must be one of: urgent, high, medium, low");
}

function parseStatus(value: string): TaskStatus {
  if (
    value === "open" ||
    value === "doing" ||
    value === "blocked" ||
    value === "done" ||
    value === "canceled"
  ) {
    return value;
  }
  throw new Error("status must be one of: open, doing, blocked, done, canceled");
}

export function isJsonOnly(args: string[]): boolean {
  return args.length === 1 && args[0] === "--json";
}

export function parseIdJsonArgs(
  args: string[],
  usage: string,
): { ok: true; taskId: string } | { ok: false; message: string } {
  const [taskId, jsonFlag, ...extra] = args;
  if (!taskId || jsonFlag !== "--json" || extra.length > 0) {
    return { ok: false, message: usage };
  }
  return { ok: true, taskId };
}

const DEPS_USAGE =
  "usage: forge deps <id> --json | " +
  "forge deps add <id> <dependency> --json | " +
  "forge deps remove <id> <dependency> --json";

export function parseDepsArgs(args: string[]):
  | { ok: true; action: "show"; taskId: string }
  | { ok: true; action: "add" | "remove"; taskId: string; dependencyId: string }
  | { ok: false; message: string } {
  const [first, second, third, fourth, ...extra] = args;
  if (first === "add" || first === "remove") {
    if (!second || !third || fourth !== "--json" || extra.length > 0) {
      return { ok: false, message: DEPS_USAGE };
    }
    return { ok: true, action: first, taskId: second, dependencyId: third };
  }

  if (!first || second !== "--json" || third !== undefined) {
    return { ok: false, message: DEPS_USAGE };
  }
  return { ok: true, action: "show", taskId: first };
}

export function parseNextArgs(
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

export function parseWebArgs(
  args: string[],
  defaultStartDir: string,
):
  | { action: "serve"; host: string; port: number; startDir: string; demo: boolean }
  | { action: "status"; json: true; startDir: string } {
  if (args[0] === "status") {
    return parseWebStatusArgs(args.slice(1), defaultStartDir);
  }

  const webOptions = {
    action: "serve" as const,
    host: "127.0.0.1",
    port: 5174,
    startDir: defaultStartDir,
    demo: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--demo") {
      webOptions.demo = true;
      continue;
    }

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

  if (webOptions.demo && webOptions.startDir !== defaultStartDir) {
    throw new Error("web option --demo cannot be combined with --dir");
  }

  return webOptions;
}

function parseWebStatusArgs(
  args: string[],
  defaultStartDir: string,
): { action: "status"; json: true; startDir: string } {
  let json = false;
  let startDir = defaultStartDir;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--json":
        json = true;
        break;
      case "--dir": {
        const value = args[index + 1];
        if (!value) {
          throw new Error("web status option --dir requires a value");
        }
        startDir = value;
        index += 1;
        break;
      }
      default:
        throw new Error(`unknown web status option: ${arg}`);
    }
  }

  if (!json) {
    throw new Error("usage: forge web status --json [--dir <path>]");
  }

  return { action: "status", json, startDir };
}
