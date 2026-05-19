export type CommandClassification = "read" | "write" | "serve";
export type CommandWorkflow = "inspect" | "claim" | "plan" | "mutate" | "verify" | "close";

export interface CommandMetadata {
  name: string;
  usage: string;
  description: string;
  classification: CommandClassification;
  supportsJson: boolean;
  examples: string[];
  agentPurpose: string;
}

interface DoctorDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  taskId?: string;
  sourcePath?: string;
  repairHint?: string;
}

export const COMMANDS = [
  {
    name: "commands",
    usage: "forge commands --json",
    description: "Emit command metadata.",
    classification: "read",
    supportsJson: true,
    examples: ["forge commands --json"],
    agentPurpose: "Discover the current CLI surface in robot-readable form.",
  },
  {
    name: "help",
    usage: "forge help --agent",
    description: "Print concise agent-oriented command help.",
    classification: "read",
    supportsJson: false,
    examples: ["forge help --agent"],
    agentPurpose: "Get compact workflow guidance for an agent loop.",
  },
  {
    name: "list",
    usage: "forge list [--all|--closed] [--links=auto|always|never]",
    description: "List task files with optional terminal links.",
    classification: "read",
    supportsJson: false,
    examples: ["forge list", "forge list --all", "forge list --closed", "forge list --links=never"],
    agentPurpose: "Inspect current repo task state without closed-task noise.",
  },
  {
    name: "ready",
    usage: "forge ready [--links=auto|always|never]",
    description: "List currently ready task files with optional terminal links.",
    classification: "read",
    supportsJson: false,
    examples: ["forge ready", "forge ready --links=always"],
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
    usage:
      "forge deps <id> --json | " +
      "forge deps add <id> <dependency> --json | " +
      "forge deps remove <id> <dependency> --json",
    description: "Emit or edit direct dependencies.",
    classification: "write",
    supportsJson: true,
    examples: [
      "forge deps F-0001 --json",
      "forge deps add F-0002 F-0001 --json",
      "forge deps remove F-0002 F-0001 --json",
    ],
    agentPurpose: "Inspect graph context and make validated dependency edits.",
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
    name: "doctor",
    usage: "forge doctor --json",
    description: "Validate task files and graph health.",
    classification: "read",
    supportsJson: true,
    examples: ["forge doctor --json"],
    agentPurpose: "Check the repo before trusting or closing work.",
  },
  {
    name: "closeout",
    usage: "forge closeout <id> --json",
    description: "Emit advisory closeout guidance for one task.",
    classification: "read",
    supportsJson: true,
    examples: ["forge closeout F-0001 --json"],
    agentPurpose: "Check what evidence or review concerns remain before closing a task.",
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
    usage: "forge prompt <id|next> [--full]",
    description: "Emit a reusable task prompt with matched guidance.",
    classification: "read",
    supportsJson: false,
    examples: ["forge prompt next", "forge prompt F-0001 --full"],
    agentPurpose: "Start an agent on a concrete task.",
  },
  {
    name: "plan",
    usage: "forge plan <id|next> --stdin",
    description: "Insert or replace a task Execution Plan section.",
    classification: "write",
    supportsJson: false,
    examples: ["forge plan F-0001 --stdin", "forge plan next --stdin"],
    agentPurpose: "Record the current implementation plan in the task body.",
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
    name: "note",
    usage: "forge note <id> --stdin",
    description: "Append text from stdin to the task Notes section.",
    classification: "write",
    supportsJson: false,
    examples: ['printf "Decision: ..." | forge note F-0001 --stdin'],
    agentPurpose: "Record implementation context without hand-editing Markdown.",
  },
  {
    name: "block",
    usage: "forge block <id> --reason <text>",
    description: "Block one task with a reason.",
    classification: "write",
    supportsJson: false,
    examples: ['forge block F-0001 --reason "Waiting on API decision"'],
    agentPurpose: "Pause work with explicit context.",
  },
  {
    name: "unblock",
    usage: "forge unblock <id>",
    description: "Clear the block reason and reopen one task.",
    classification: "write",
    supportsJson: false,
    examples: ["forge unblock F-0001"],
    agentPurpose: "Return blocked work to the open queue.",
  },
  {
    name: "review",
    usage: "forge review <id> --reason <text>",
    description: "Record a review reason without changing task status.",
    classification: "write",
    supportsJson: false,
    examples: ['forge review F-0001 --reason "Needs product wording decision"'],
    agentPurpose: "Flag judgment needed before continuing or closing.",
  },
  {
    name: "set",
    usage:
      "forge set <id> [--priority <value>] [--status <value>] " +
      "[--area <value>] [--scope <glob>] [--closed-at <timestamp>] " +
      "[--close-reason <text>] --json",
    description: "Update common task metadata.",
    classification: "write",
    supportsJson: true,
    examples: ["forge set F-0001 --priority high --json"],
    agentPurpose: "Update scalar/list metadata without hand-editing frontmatter.",
  },
  {
    name: "done",
    usage: "forge done <id> [--reason <text>] [--json]",
    description: "Mark one task done.",
    classification: "write",
    supportsJson: true,
    examples: ["forge done F-0001", 'forge done F-0001 --reason "Verified" --json'],
    agentPurpose: "Close a task after verification.",
  },
  {
    name: "web",
    usage:
      "forge web [--host <host>] [--port <port>] [--dir <path>] [--demo] | " +
      "forge web status --json",
    description: "Serve the local web viewer or report the active web session.",
    classification: "serve",
    supportsJson: false,
    examples: [
      "forge web",
      "forge web --demo",
      "forge web --dir /path/to/repo --port 5175",
      "forge web status --json",
    ],
    agentPurpose: "Open or discover a human review surface for the task graph.",
  },
] satisfies CommandMetadata[];

export type CommandName = (typeof COMMANDS)[number]["name"];

export const COMMAND_WORKFLOWS = {
  commands: "inspect",
  help: "inspect",
  list: "inspect",
  ready: "inspect",
  queue: "inspect",
  next: "claim",
  show: "inspect",
  blockers: "inspect",
  deps: "mutate",
  guidance: "inspect",
  doctor: "verify",
  closeout: "close",
  create: "plan",
  prompt: "plan",
  plan: "plan",
  "loop-prompt": "plan",
  claim: "claim",
  note: "mutate",
  block: "mutate",
  unblock: "mutate",
  review: "mutate",
  set: "mutate",
  done: "close",
  web: "inspect",
} satisfies Record<CommandName, CommandWorkflow>;

export const COMMAND_WORKFLOW_ORDER: CommandWorkflow[] = [
  "inspect",
  "claim",
  "plan",
  "mutate",
  "verify",
  "close",
];

export const USAGE = ["Usage:", ...COMMANDS.map((command) => `  ${command.usage}`)].join(
  "\n",
);
