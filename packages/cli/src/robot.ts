import {
  type GuidanceBundle,
  type GuidanceMatch,
  type RankedQueueEntry,
  type Task,
  type TaskGraphAnalysis,
} from "@forge/core";
import {
  COMMANDS,
  COMMAND_WORKFLOWS,
  COMMAND_WORKFLOW_ORDER,
  type CommandMetadata,
  type CommandName,
} from "./command-metadata";

export function toRobotTaskSummary(task: Task): Record<string, unknown> {
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

export function toRobotTaskDocument(task: Task): Record<string, unknown> {
  return {
    ...toRobotTaskSummary(task),
    kind: task.kind,
    parent: task.parent || null,
    created_at: task.created_at,
    updated_at: task.updated_at,
    closed_at: task.closed_at || null,
    close_reason: task.close_reason || null,
    blocked_reason: task.blocked_reason || null,
    review_reason: task.review_reason || null,
    sourcePath: task.sourcePath,
    body: task.body,
    sections: parseMarkdownSections(task.body),
  };
}

export function toRobotQueueTask(
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

export function toRobotDiagnostics(analysis: TaskGraphAnalysis): Record<string, unknown> {
  return {
    missingDependencies: analysis.missingDependencies,
    dependencyCycles: analysis.dependencyCycles,
    duplicateTaskIds: analysis.duplicateTaskIds,
  };
}

export function toRobotCommandMetadata(command: CommandMetadata): Record<string, unknown> {
  return {
    name: command.name,
    usage: command.usage,
    description: command.description,
    workflow: COMMAND_WORKFLOWS[command.name as CommandName],
    classification: command.classification,
    supportsJson: command.supportsJson,
    examples: command.examples,
    agentPurpose: command.agentPurpose,
  };
}

export function formatAgentHelp(): string {
  const lines = ["Forge agent command reference", ""];

  for (const workflow of COMMAND_WORKFLOW_ORDER) {
    const commands = COMMANDS.filter((command) => COMMAND_WORKFLOWS[command.name] === workflow);
    if (commands.length === 0) {
      continue;
    }

    lines.push(`${capitalize(workflow)}:`);
    for (const command of commands) {
      lines.push(
        `- ${command.usage} [${command.classification}] ${command.agentPurpose}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export function toRobotGuidanceBundle(bundle: GuidanceBundle): Record<string, unknown> {
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

export function formatGuidanceText(bundle: GuidanceBundle, full: boolean): string {
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

export function toRobotBlockers(task: Task, analysis: TaskGraphAnalysis): Array<Record<string, unknown>> {
  const blockers: Array<Record<string, unknown>> = [];

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

export function toDependencySummary(
  taskId: string,
  task: Task | undefined,
): Record<string, unknown> {
  return {
    id: taskId,
    title: task?.title ?? null,
    status: task?.status ?? null,
  };
}

export function parseMarkdownSections(body: string): Array<{ title: string; body: string }> {
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

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}
