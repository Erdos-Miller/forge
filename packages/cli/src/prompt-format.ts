import type { Task } from "@forge/core";
import {
  COMMANDS,
  COMMAND_WORKFLOWS,
  COMMAND_WORKFLOW_ORDER,
} from "./command-metadata";

export function formatAgentPrompt(task: Task): string {
  const lines = [
    `Goal: Complete Forge task ${task.id} - ${task.title}`,
    "",
    "Follow the repository's AGENTS.md instructions and the Forge operating loop.",
    "Before editing code or docs, claim the task. Keep work inside the declared scope, " +
      "update task notes with decisions and verification, and mark the task done only " +
      "when acceptance criteria are satisfied.",
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
    formatPromptCommandGuidance(),
  ];

  return lines.join("\n");
}

export function formatLoopPrompt(): string {
  return [
    "/goal Work the Forge execution loop until no ready task remains or a stop condition is hit.",
    "",
    "At the start of each iteration, use `forge prompt next` to select the current " +
      "highest-ranked ready task. Claim it before editing. Follow the repository's " +
      "AGENTS.md instructions and the Forge operating loop.",
    "",
    "For each task, keep edits inside the task scope. Update the task notes with " +
      "decisions, blockers, and verification. Mark the task done only when its " +
      "acceptance criteria are satisfied and concrete evidence supports completion. " +
      "Commit the code and task-file updates together.",
    "",
    "After committing, start the next iteration with `forge prompt next` again.",
    "",
    "Stop when no task is ready, the selected task is ambiguous, required changes " +
      "exceed scope, verification cannot run, or you need user judgment before " +
      "continuing. Report the blocker plus the next input needed.",
    "",
    formatPromptCommandGuidance(),
  ].join("\n");
}

function formatPromptCommandGuidance(): string {
  const lines = [
    "Command guidance:",
    "- Prefer structured Forge commands for frontmatter, lifecycle, plan, " +
      "verification, and other command-owned writes.",
    "- Inspect dependency state with structured commands before changing dependencies; " +
      "prefer a dependency write command when one exists.",
    "- Direct Markdown edits are acceptable for rich task body content that no command " +
      "owns, but preserve frontmatter and canonical sections.",
    "- Use `.forge/harness-engineering.md` when deciding whether a failure needs " +
      "a fixture, harness, doctor warning, or smoke test.",
    "- For web UI, Vite server, or `/api/tasks` changes, run `bun run harness:web`.",
    "- For CLI workflow, command, prompt, or robot JSON changes, run `bun run harness:cli`.",
    "- For broad behavior, graph, task-store, or cross-surface changes, run " +
      "`bun run harness:check`.",
    "",
    "Current command surface:",
  ];

  for (const workflow of COMMAND_WORKFLOW_ORDER) {
    const commands = COMMANDS.filter(
      (command) => COMMAND_WORKFLOWS[command.name] === workflow,
    );
    if (commands.length === 0) {
      continue;
    }

    lines.push(`${capitalize(workflow)}:`);
    for (const command of commands) {
      lines.push(`- ${command.usage} [${command.classification}]`);
    }
  }

  return lines.join("\n");
}
function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
