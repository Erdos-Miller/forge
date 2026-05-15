import { promises as fs } from "node:fs";
import path from "node:path";
import {
  inspectGuidanceConfig,
  parseTaskFile,
  TaskParseError,
  type GuidanceBundle,
  type Task,
  type TaskGraphAnalysis,
} from "@forge/core";
import { parseMarkdownSections } from "./robot";

export interface DoctorDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  taskId?: string;
  sourcePath?: string;
  repairHint?: string;
}

export async function inspectTaskStore(
  repoRoot: string,
): Promise<{ tasks: Task[]; diagnostics: DoctorDiagnostic[] }> {
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const diagnostics: DoctorDiagnostic[] = [];
  const tasks: Task[] = [];

  for (const sourcePath of await listMarkdownFiles(tasksDir)) {
    const contents = await fs.readFile(sourcePath, "utf8");
    if (contents.includes("<<<<<<<") || contents.includes("=======") || contents.includes(">>>>>>>")) {
      diagnostics.push({
        code: "merge_conflict_marker",
        severity: "error",
        message: "task file contains merge conflict markers",
        sourcePath,
      });
    }

    try {
      const parsed = parseTaskFile(sourcePath, contents);
      tasks.push(parsed.task);
      diagnostics.push(...getFrontmatterDoctorDiagnostics(parsed, sourcePath));
    } catch (error) {
      diagnostics.push(toParseDoctorDiagnostic(error, sourcePath));
    }
  }

  return { tasks, diagnostics };
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return listMarkdownFiles(entryPath);
        }
        return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
      }),
    )
  )
    .flat()
    .sort();
}

function getFrontmatterDoctorDiagnostics(
  parsed: ReturnType<typeof parseTaskFile>,
  sourcePath: string,
): DoctorDiagnostic[] {
  const diagnostics: DoctorDiagnostic[] = [];
  const taskId = parsed.task.id;

  for (const field of ["blocked_by", "blocks", "block_reason"]) {
    if (field in parsed.frontmatter) {
      diagnostics.push({
        code: "invalid_block_field",
        severity: "error",
        message: `unsupported block field "${field}"; use depends_on/status instead`,
        taskId,
        sourcePath,
      });
    }
  }

  for (const field of ["review", "review_state", "needs_review"]) {
    if (field in parsed.frontmatter) {
      diagnostics.push({
        code: "invalid_review_field",
        severity: "error",
        message: `unsupported review field "${field}"`,
        taskId,
        sourcePath,
      });
    }
  }

  diagnostics.push(...getCompletionTimestampDoctorDiagnostics(parsed.task));
  diagnostics.push(...getExecutionPlanDoctorDiagnostics(parsed.task));

  return diagnostics;
}

function getCompletionTimestampDoctorDiagnostics(task: Task): DoctorDiagnostic[] {
  const isClosed = task.status === "done" || task.status === "canceled";

  if (isClosed && !task.closed_at) {
    return [
      {
        code: "missing_closed_at",
        severity: "error",
        message: `closed task ${task.id} is missing closed_at`,
        taskId: task.id,
        sourcePath: task.sourcePath,
        repairHint:
          "Set closed_at to the ISO timestamp when the task was completed or canceled.",
      },
    ];
  }

  if (!isClosed && task.closed_at) {
    return [
      {
        code: "unexpected_closed_at",
        severity: "error",
        message: `non-closed task ${task.id} has closed_at`,
        taskId: task.id,
        sourcePath: task.sourcePath,
        repairHint: "Remove closed_at, or set status to done/canceled if the task is closed.",
      },
    ];
  }

  if (task.closed_at && Date.parse(task.closed_at) < Date.parse(task.created_at)) {
    return [
      {
        code: "closed_at_before_created_at",
        severity: "error",
        message: `task ${task.id} has closed_at earlier than created_at`,
        taskId: task.id,
        sourcePath: task.sourcePath,
        repairHint: "Set closed_at to a timestamp at or after created_at.",
      },
    ];
  }

  return [];
}

function getExecutionPlanDoctorDiagnostics(task: Task): DoctorDiagnostic[] {
  if (!taskIsActiveForPlanning(task) || hasMarkdownSection(task.body, "Execution Plan")) {
    return [];
  }

  return [
    {
      code: "missing_execution_plan",
      severity: "warning",
      message: `active task ${task.id} is missing ## Execution Plan; run forge plan ${task.id} --stdin`,
      taskId: task.id,
      sourcePath: task.sourcePath,
      repairHint: `Run forge plan ${task.id} --stdin before continuing implementation.`,
    },
  ];
}

function taskIsActiveForPlanning(task: Task): boolean {
  return task.status === "doing" || Boolean(task.claimed_by);
}

function hasMarkdownSection(body: string, sectionTitle: string): boolean {
  return new RegExp(`^## ${escapeRegExp(sectionTitle)}\\s*$`, "m").test(body);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getGuidanceDoctorDiagnostics(repoRoot: string): Promise<DoctorDiagnostic[]> {
  const diagnostics = await inspectGuidanceConfig(repoRoot);
  return diagnostics.map((diagnostic) => {
    const mapped = mapGuidanceDiagnostic(diagnostic.kind);
    return {
      code: mapped.code,
      severity: mapped.severity,
      message: diagnostic.message,
      sourcePath: diagnostic.path
        ? path.join(repoRoot, ".forge", diagnostic.path.replace(/^\.forge\//, ""))
        : path.join(repoRoot, ".forge", "guidance.yml"),
      repairHint: getGuidanceRepairHint(diagnostic.kind),
    };
  });
}

function mapGuidanceDiagnostic(
  kind: GuidanceBundle["diagnostics"][number]["kind"],
): { code: string; severity: "error" | "warning" } {
  switch (kind) {
    case "invalid_config":
      return { code: "invalid_guidance_config", severity: "error" };
    case "missing_include":
      return { code: "missing_guidance_include", severity: "error" };
    case "unreadable_include":
      return { code: "unreadable_guidance_include", severity: "error" };
    case "duplicate_include":
      return { code: "duplicate_guidance_include", severity: "warning" };
    case "local_file_not_ignored":
      return { code: "local_guidance_not_ignored", severity: "warning" };
    case "missing_config":
      return { code: "missing_guidance_config", severity: "warning" };
  }
}

function getGuidanceRepairHint(
  kind: GuidanceBundle["diagnostics"][number]["kind"],
): string {
  switch (kind) {
    case "invalid_config":
      return "Fix .forge/guidance.yml so version is 1 and routes are valid.";
    case "missing_include":
      return "Create the referenced guidance file or remove the route.";
    case "unreadable_include":
      return "Make the guidance include a readable Markdown file.";
    case "duplicate_include":
      return "Remove the duplicate route or make its conditions distinct.";
    case "local_file_not_ignored":
      return "Add .forge/local/** to .gitignore or move the file out of .forge/local.";
    case "missing_config":
      return "Create .forge/guidance.yml if this repo uses routed guidance.";
  }
}

export async function getTaskCloseoutGuidance(
  repoRoot: string,
  task: Task,
): Promise<Record<string, unknown>> {
  const sections = parseMarkdownSections(task.body);
  const executionPlan = findSection(sections, "Execution Plan");
  const notes = findSection(sections, "Notes");
  const verificationNotesPresent = hasVerificationNotes(notes?.body ?? "");
  const stopConditions = extractLabeledBlock(executionPlan?.body ?? "", "Stop conditions");
  const humanReviewTriggers = extractLabeledBlock(
    executionPlan?.body ?? "",
    "Human review triggers",
  );
  const blockers = [
    ...stringIfPresent(task.blocked_reason),
    ...extractPrefixedLines(notes?.body ?? "", "Blocked:"),
  ];
  const review = [
    ...stringIfPresent(task.review_reason),
    ...humanReviewTriggers,
    ...extractPrefixedLines(notes?.body ?? "", "Review needed:"),
  ];
  const findings = getCloseoutFindings(task, {
    executionPlanPresent: Boolean(executionPlan),
    verificationNotesPresent,
    blockers,
    review,
    stopConditions,
  });

  return {
    ready_to_close: findings.length === 0,
    execution_plan_present: Boolean(executionPlan),
    verification_notes_present: verificationNotesPresent,
    expected_quality_command: await getExpectedQualityCommand(repoRoot),
    blockers,
    review,
    stop_conditions: stopConditions,
    findings,
  };
}

function getCloseoutFindings(
  task: Task,
  input: {
    executionPlanPresent: boolean;
    verificationNotesPresent: boolean;
    blockers: string[];
    review: string[];
    stopConditions: string[];
  },
): Array<{ code: string; severity: "warning"; message: string }> {
  const findings: Array<{ code: string; severity: "warning"; message: string }> = [];
  if (!input.executionPlanPresent) {
    findings.push({
      code: "missing_execution_plan",
      severity: "warning",
      message: `task ${task.id} has no ## Execution Plan`,
    });
  }
  if (!input.verificationNotesPresent) {
    findings.push({
      code: "missing_verification_notes",
      severity: "warning",
      message: `task ${task.id} has no verification evidence in Notes`,
    });
  }
  if (input.blockers.length > 0 || task.status === "blocked") {
    findings.push({
      code: "blocker_present",
      severity: "warning",
      message: `task ${task.id} still has blocker context`,
    });
  }
  if (input.review.length > 0) {
    findings.push({
      code: "review_needed",
      severity: "warning",
      message: `task ${task.id} has review context to resolve before closeout`,
    });
  }
  if (input.stopConditions.length > 0) {
    findings.push({
      code: "stop_condition_present",
      severity: "warning",
      message: `task ${task.id} has stop-condition text to review before closeout`,
    });
  }
  return findings;
}

async function getExpectedQualityCommand(repoRoot: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, "package.json"), "utf8");
    const scripts = JSON.parse(raw).scripts ?? {};
    for (const scriptName of ["quality:check", "harness:check", "test"]) {
      if (typeof scripts[scriptName] === "string") {
        return `bun run ${scriptName}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function findSection(
  sections: Array<{ title: string; body: string }>,
  title: string,
): { title: string; body: string } | undefined {
  return sections.find((section) => section.title.toLowerCase() === title.toLowerCase());
}

function hasVerificationNotes(notes: string): boolean {
  return /^Verification:\s*$/im.test(notes) || /^- `?(bun|npm|pnpm|yarn|cargo|deno) /im.test(notes);
}

function extractPrefixedLines(body: string, prefix: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((line) => line.slice(prefix.length).trim())
    .filter(Boolean);
}

function extractLabeledBlock(body: string, label: string): string[] {
  const labelPattern = new RegExp(`^${escapeRegExp(label)}:\\s*$`, "im");
  const match = labelPattern.exec(body);
  if (!match) {
    return [];
  }

  const rest = body.slice(match.index + match[0].length);
  const nextLabel = /^\w[\w -]+:\s*$/m.exec(rest);
  const rawBlock = rest.slice(0, nextLabel?.index ?? rest.length).trim();
  return normalizeAdvisoryLines(rawBlock);
}

function normalizeAdvisoryLines(rawBlock: string): string[] {
  if (!rawBlock || /^(none|n\/a|not applicable)\.?$/i.test(rawBlock)) {
    return [];
  }
  return rawBlock
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean)
    .filter((line) => !/^(none|n\/a|not applicable)\.?$/i.test(line));
}

function stringIfPresent(value: string | undefined): string[] {
  return value?.trim() ? [value.trim()] : [];
}

function toParseDoctorDiagnostic(error: unknown, sourcePath: string): DoctorDiagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: getParseDiagnosticCode(error, message),
    severity: "error",
    message,
    sourcePath,
  };
}

function getParseDiagnosticCode(error: unknown, message: string): string {
  if (
    message.includes("malformed YAML frontmatter") ||
    message.includes("end of the stream") ||
    message.includes("bad indentation") ||
    message.includes("can not read") ||
    message.includes("incomplete explicit mapping pair")
  ) {
    return "malformed_yaml";
  }

  if (!(error instanceof TaskParseError)) {
    return "malformed_yaml";
  }

  if (error instanceof TaskParseError) {
    if (message.includes("missing YAML frontmatter")) {
      return "missing_frontmatter";
    }
    if (message.includes("timestamp")) {
      return "invalid_timestamp";
    }
    if (message.includes("must be one of")) {
      return "invalid_enum";
    }
    return "malformed_yaml";
  }
  return "parse_failed";
}

export function getGraphDoctorDiagnostics(analysis: TaskGraphAnalysis): DoctorDiagnostic[] {
  return [
    ...analysis.duplicateTaskIds.map((diagnostic) => ({
      code: "duplicate_id",
      severity: "error" as const,
      message: `duplicate task id ${diagnostic.taskId}`,
      taskId: diagnostic.taskId,
      sourcePath: diagnostic.sourcePaths.join(", "),
    })),
    ...analysis.missingDependencies.map((diagnostic) => ({
      code: "missing_dependency",
      severity: "error" as const,
      message: `task ${diagnostic.taskId} depends on missing task ${diagnostic.dependencyId}`,
      taskId: diagnostic.taskId,
    })),
    ...analysis.dependencyCycles.map((diagnostic) => ({
      code: "dependency_cycle",
      severity: "error" as const,
      message: `dependency cycle: ${diagnostic.taskIds.join(" -> ")}`,
      taskId: diagnostic.taskIds[0],
    })),
  ];
}
