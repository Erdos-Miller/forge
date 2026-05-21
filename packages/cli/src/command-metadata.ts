import { CREATE_USAGE } from "./args";

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
    name: "user-guidance",
    usage: "forge user-guidance",
    description: "Print personal user guidance when configured.",
    classification: "read",
    supportsJson: false,
    examples: ["forge user-guidance"],
    agentPurpose: "Inspect personal guidance stored outside repo task state.",
  },
  {
    name: "worktree-status",
    usage: "forge worktree-status --json [--task <id>]",
    description: "Classify dirty worktree files for the current task.",
    classification: "read",
    supportsJson: true,
    examples: ["forge worktree-status --json", "forge worktree-status --json --task F-0001"],
    agentPurpose:
      "Classify dirty files: continue on non_blocking, pause on review, stop on blocking.",
  },
  {
    name: "projects",
    usage:
      "forge projects --json | forge projects infer --json | " +
      "forge projects migrate --dry-run --json | " +
      "forge projects add <id> --label <label> --path <glob> --json | " +
      "forge projects update <id> --path <glob> --json | " +
      "forge projects remove <id> --json",
    description: "Inspect or maintain Project configuration.",
    classification: "write",
    supportsJson: true,
    examples: [
      "forge projects --json",
      "forge projects infer --json",
      "forge projects migrate --dry-run --json",
      'forge projects add web --label "Web" --path "packages/web/**" --json',
      'forge projects update web --path "packages/web/test/**" --json',
      "forge projects remove web --json",
    ],
    agentPurpose: "Maintain Project config without hand-editing YAML.",
  },
  {
    name: "scopes",
    usage:
      "forge scopes --json | forge scopes infer --json | " +
      "forge scopes add <id> --label <label> --path <glob> --json | " +
      "forge scopes update <id> --path <glob> --json",
    description: "Legacy-compatible alias for Project configuration.",
    classification: "write",
    supportsJson: true,
    examples: [
      "forge scopes --json",
      "forge scopes infer --json",
      'forge scopes add web --label "Web" --path "packages/web/**" --json',
      'forge scopes update web --path "packages/web/test/**" --json',
    ],
    agentPurpose: "Use compatible legacy scope commands when Project commands are unavailable.",
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
    usage: CREATE_USAGE.replace(/^usage: /, ""),
    description: "Create a canonical task file with expected Markdown fields.",
    classification: "write",
    supportsJson: true,
    examples: [
      'forge create "Add web queue" --project web --area web --json',
      'forge create "Tighten CLI help" --area cli --json',
      'forge create F-0006 --title "Add task creation" --why "New tasks need context."',
    ],
    agentPurpose:
      "Add planned work by Project or cwd context; use scope only for edit-boundary narrowing.",
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
      "[--project <id>] [--area <value>] [--scope <glob>] [--closed-at <timestamp>] " +
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
  "user-guidance": "inspect",
  "worktree-status": "inspect",
  projects: "mutate",
  scopes: "mutate",
  deps: "mutate",
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
