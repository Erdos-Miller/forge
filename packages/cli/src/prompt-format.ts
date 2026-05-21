import type { Task } from "@forge/core";
import {
  COMMANDS,
  COMMAND_WORKFLOWS,
  COMMAND_WORKFLOW_ORDER,
} from "./command-metadata";
import { parseMarkdownSections } from "./robot";
import { formatPersonalGuidancePrompt } from "./user-guidance";

export function formatAgentPrompt(task: Task, personalGuidance = ""): string {
  const personalGuidanceBlock = formatPersonalGuidancePrompt(personalGuidance);
  const lines = [
    `Goal: Complete Forge task ${task.id} - ${task.title}`,
    "",
    "Follow the repository's AGENTS.md instructions and the Forge operating loop.",
    "Before editing code or docs, claim the task. Keep work inside the declared scope, " +
      "update task notes with decisions and verification, and mark the task done only " +
      "when acceptance criteria are satisfied.",
    "If the work changes conventions, architecture, or public semantics, record the " +
      "decision in task Notes or a durable `.forge/decisions/` record.",
    "If dirty worktree state affects whether to continue, run " +
      "`forge worktree-status --json`: continue on `non_blocking`, pause on `review`, " +
      "and stop on `blocking`.",
    "",
    `Task file: ${task.sourcePath}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Area: ${task.area ?? "-"}`,
    `Depends on: ${task.depends_on.length ? task.depends_on.join(", ") : "none"}`,
    "Scope:",
    ...task.scope.map((scope) => `- ${scope}`),
    "",
    formatTaskContent(task.body),
    "",
    ...(personalGuidanceBlock ? [personalGuidanceBlock, ""] : []),
    formatPromptCommandGuidance(),
  ];

  return lines.join("\n");
}

export function formatLoopPrompt(personalGuidance = ""): string {
  const personalGuidanceBlock = formatPersonalGuidancePrompt(personalGuidance);
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
    "When a task changes conventions, architecture, or public semantics, capture " +
      "the durable decision in task Notes or `.forge/decisions/` before closeout.",
    "When the worktree is dirty, classify it with `forge worktree-status --json` " +
      "before deciding whether to continue or stop: continue on `non_blocking`, " +
      "pause on `review`, and stop on `blocking`.",
    "",
    "After committing, start the next iteration with `forge prompt next` again.",
    "",
    "Stop when no task is ready, the selected task is ambiguous, required changes " +
      "exceed scope, verification cannot run, or you need user judgment before " +
    "continuing. Report the blocker plus the next input needed.",
    "",
    ...(personalGuidanceBlock ? [personalGuidanceBlock, ""] : []),
    formatPromptCommandGuidance(),
  ].join("\n");
}

function formatTaskContent(body: string): string {
  const sections = parseMarkdownSections(body).map((section, index) => ({ ...section, index }));
  if (sections.length === 0) {
    const content = stripLeadingTitle(body).trim();
    return ["Task content:", content || "(empty)"].join("\n");
  }

  const used = new Set<number>();
  const why = selectSection(sections, used, ["why", "problem", "context"]);
  const success = selectSection(sections, used, ["what success looks like", "goal", "outcome"]);
  const acceptance = selectSection(sections, used, ["acceptance criteria", "acceptance"]);
  const verification = selectSection(sections, used, ["verification", "verify"]);
  const notes = selectAllSections(sections, used, ["notes"]);
  const supporting = sections.filter((section) => !used.has(section.index));
  const lines = ["Task brief:"];

  appendSection(lines, "Why", why);
  appendSection(lines, "What success looks like", success);
  appendSection(lines, "Acceptance Criteria", acceptance);
  appendSection(lines, "Verification", verification);
  for (const note of notes) {
    appendSection(lines, note.title, note);
  }

  if (supporting.length > 0) {
    lines.push("", "Supporting task details:");
    for (const section of supporting) {
      appendSection(lines, section.title, section);
    }
  }

  return lines.join("\n");
}

function appendSection(
  lines: string[],
  title: string,
  section: { body: string } | undefined,
) {
  if (!section) {
    return;
  }
  lines.push("", `## ${title}`, "", section.body.trim());
}

function selectSection(
  sections: Array<{ title: string; body: string; index: number }>,
  used: Set<number>,
  titles: string[],
) {
  const section = sections.find((candidate) => {
    return !used.has(candidate.index) && titles.includes(normalizeTitle(candidate.title));
  });
  if (section) {
    used.add(section.index);
  }
  return section;
}

function selectAllSections(
  sections: Array<{ title: string; body: string; index: number }>,
  used: Set<number>,
  titles: string[],
) {
  return sections.filter((section) => {
    if (used.has(section.index) || !titles.includes(normalizeTitle(section.title))) {
      return false;
    }
    used.add(section.index);
    return true;
  });
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

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingTitle(body: string) {
  return body.replace(/^\s*# .*(?:\r?\n){1,2}/, "");
}
