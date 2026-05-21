import { promises as fs } from "node:fs";
import path from "node:path";
import {
  parseTaskFile,
  readScopeConfig,
  TaskParseError,
  type ScopeConfigEntry,
  type Task,
  type TaskGraphAnalysis,
} from "@forge/core";
import { parseMarkdownSections } from "./robot";
import {
  getWorktreeStatusPayload,
  type WorktreeStatusFile,
} from "./worktree-status";

export interface DoctorDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  taskId?: string;
  sourcePath?: string;
  repairHint?: string;
  reason?: string;
  classification?: string;
  path?: string;
  scopeId?: string;
  scopeIds?: string[];
  taskIds?: string[];
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
  diagnostics.push(...getTaskBriefDoctorDiagnostics(parsed.task));

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

function getTaskBriefDoctorDiagnostics(task: Task): DoctorDiagnostic[] {
  if (task.status === "done" || task.status === "canceled") {
    return [];
  }

  const sections = parseMarkdownSections(task.body);
  return [
    ...getRequiredTextSectionDiagnostic(task, sections, "Why", "why"),
    ...getRequiredTextSectionDiagnostic(
      task,
      sections,
      "What success looks like",
      "success",
    ),
    ...getRequiredListSectionDiagnostic(
      task,
      sections,
      "Acceptance Criteria",
      "acceptance",
    ),
    ...getRequiredListSectionDiagnostic(task, sections, "Verification", "verification"),
  ];
}

function getRequiredTextSectionDiagnostic(
  task: Task,
  sections: Array<{ title: string; body: string }>,
  title: string,
  codeName: string,
): DoctorDiagnostic[] {
  const section = findSection(sections, title);
  if (!section) {
    return [getTaskBriefDiagnostic(task, `missing_${codeName}`, title, "is missing")];
  }
  if (isPlaceholderText(section.body)) {
    return [getTaskBriefDiagnostic(task, `placeholder_${codeName}`, title, "has placeholder text")];
  }
  return [];
}

function getRequiredListSectionDiagnostic(
  task: Task,
  sections: Array<{ title: string; body: string }>,
  title: string,
  codeName: string,
): DoctorDiagnostic[] {
  const section = findSection(sections, title);
  if (!section) {
    return [getTaskBriefDiagnostic(task, `missing_${codeName}`, title, "is missing")];
  }
  if (getMeaningfulSectionLines(section.body).length === 0) {
    return [getTaskBriefDiagnostic(task, `placeholder_${codeName}`, title, "is empty or placeholder")];
  }
  return [];
}

function getTaskBriefDiagnostic(
  task: Task,
  codeSuffix: string,
  sectionTitle: string,
  problem: string,
): DoctorDiagnostic {
  return {
    code: `task_brief_${codeSuffix}`,
    severity: "warning",
    message: `task ${task.id} ${sectionTitle} ${problem}`,
    taskId: task.id,
    sourcePath: task.sourcePath,
    repairHint: `Fill in ## ${sectionTitle} with concrete task context.`,
  };
}

function getMeaningfulSectionLines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean)
    .filter((line) => !isPlaceholderText(line));
}

function isPlaceholderText(value: string): boolean {
  const normalized = value.trim().replace(/^[-*]\s+/, "");
  return (
    normalized.length === 0 ||
    normalized === "..." ||
    /^todo\b/i.test(normalized) ||
    /placeholder/i.test(normalized)
  );
}

function hasMarkdownSection(body: string, sectionTitle: string): boolean {
  return new RegExp(`^## ${escapeRegExp(sectionTitle)}\\s*$`, "m").test(body);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getTaskCloseoutGuidance(
  repoRoot: string,
  task: Task,
  tasks: Task[] = [task],
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
  const worktreeFindings = await getCloseoutWorktreeFindings(repoRoot, tasks, task);
  const findings = getCloseoutFindings(task, {
    executionPlanPresent: Boolean(executionPlan),
    verificationNotesPresent,
    blockers,
    review,
    stopConditions,
    worktreeFindings,
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
    worktreeFindings: CloseoutFinding[];
  },
): CloseoutFinding[] {
  const findings: CloseoutFinding[] = [...input.worktreeFindings];
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

interface CloseoutFinding {
  code: string;
  severity: "warning";
  message: string;
  path?: string;
  reason?: string;
  classification?: string;
}

export async function getWorktreeDoctorDiagnostics(
  repoRoot: string,
  tasks: Task[],
): Promise<DoctorDiagnostic[]> {
  const diagnostics: DoctorDiagnostic[] = [];
  const activeClaimedTasks = tasks.filter((task) => {
    return task.claimed_by && task.status !== "done" && task.status !== "canceled";
  });

  for (const task of activeClaimedTasks) {
    const files = await getWorktreeConflictFiles(repoRoot, tasks, task);
    diagnostics.push(...files.map((file) => toWorktreeDoctorDiagnostic(repoRoot, task, file)));
  }

  return diagnostics;
}

export async function getScopeConfigDoctorDiagnostics(
  repoRoot: string,
  tasks: Task[],
): Promise<DoctorDiagnostic[]> {
  const result = await readScopeConfig(repoRoot);
  if (!result.exists) {
    return [];
  }

  const activeTasks = tasks.filter((task) => task.status !== "done" && task.status !== "canceled");
  const diagnostics: DoctorDiagnostic[] = [];
  diagnostics.push(...getEmptyScopeConfigDiagnostics(result.sourcePath, result.config.scopes));
  diagnostics.push(...getUnmatchedTaskDiagnostics(result.sourcePath, result.config.scopes, activeTasks));
  diagnostics.push(...getUnusedScopePathDiagnostics(result.sourcePath, result.config.scopes, activeTasks));
  diagnostics.push(...getOverlappingScopeDiagnostics(result.sourcePath, result.config.scopes));
  return diagnostics;
}

function getEmptyScopeConfigDiagnostics(
  sourcePath: string,
  scopes: ScopeConfigEntry[],
): DoctorDiagnostic[] {
  if (scopes.length > 0) {
    return [];
  }
  return [
    {
      code: "scope_config_empty",
      severity: "warning",
      message: "configured scope file has no scopes",
      sourcePath,
      repairHint: "Run forge scopes infer --json, then add useful scopes with forge scopes add.",
    },
  ];
}

function getUnmatchedTaskDiagnostics(
  sourcePath: string,
  scopes: ScopeConfigEntry[],
  tasks: Task[],
): DoctorDiagnostic[] {
  if (scopes.length === 0) {
    return [];
  }
  const unmatchedTaskIds = tasks
    .filter((task) => !taskMatchesConfiguredScope(task, scopes))
    .map((task) => task.id)
    .sort();
  if (unmatchedTaskIds.length < 2) {
    return [];
  }
  return [
    {
      code: "scope_config_unmatched_tasks",
      severity: "warning",
      message: `${unmatchedTaskIds.length} active tasks do not match any configured scope`,
      sourcePath,
      taskIds: unmatchedTaskIds,
      repairHint: "Run forge scopes infer --json and update .forge/scopes.yml for missing areas.",
    },
  ];
}

function getUnusedScopePathDiagnostics(
  sourcePath: string,
  scopes: ScopeConfigEntry[],
  tasks: Task[],
): DoctorDiagnostic[] {
  const taskScopes = tasks.flatMap((task) => task.scope);
  return scopes.flatMap((scope) =>
    scope.paths
      .filter((scopePath) => !taskScopes.some((taskScope) => scopePathsOverlap(scopePath, taskScope)))
      .map((scopePath) => ({
        code: "scope_config_unused_path",
        severity: "warning" as const,
        message: `configured scope ${scope.id} path ${scopePath} matches no active task scopes`,
        sourcePath,
        scopeId: scope.id,
        path: scopePath,
        repairHint: `Remove ${scopePath}, or update it with forge scopes update ${scope.id} --path <glob> --json.`,
      })),
  );
}

function getOverlappingScopeDiagnostics(
  sourcePath: string,
  scopes: ScopeConfigEntry[],
): DoctorDiagnostic[] {
  const diagnostics: DoctorDiagnostic[] = [];
  for (let leftIndex = 0; leftIndex < scopes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < scopes.length; rightIndex += 1) {
      const left = scopes[leftIndex];
      const right = scopes[rightIndex];
      const overlappingPath = findOverlappingScopePath(left, right);
      if (!overlappingPath) {
        continue;
      }
      diagnostics.push({
        code: "scope_config_overlap",
        severity: "warning",
        message: `configured scopes ${left.id} and ${right.id} overlap at ${overlappingPath}`,
        sourcePath,
        scopeIds: [left.id, right.id],
        path: overlappingPath,
        repairHint: "Narrow one scope path so each task area maps to one configured scope.",
      });
    }
  }
  return diagnostics;
}

function taskMatchesConfiguredScope(task: Task, scopes: ScopeConfigEntry[]): boolean {
  return task.scope.some((taskScope) =>
    scopes.some((scope) =>
      scope.paths.some((configuredPath) => scopePathsOverlap(configuredPath, taskScope)),
    ),
  );
}

function findOverlappingScopePath(
  left: ScopeConfigEntry,
  right: ScopeConfigEntry,
): string | null {
  for (const leftPath of left.paths) {
    for (const rightPath of right.paths) {
      if (scopePathsOverlap(leftPath, rightPath)) {
        return `${leftPath} <> ${rightPath}`;
      }
    }
  }
  return null;
}

function scopePathsOverlap(left: string, right: string): boolean {
  const leftPrefix = getScopePathPrefix(left);
  const rightPrefix = getScopePathPrefix(right);
  return isSameOrChildPath(leftPrefix, rightPrefix) || isSameOrChildPath(rightPrefix, leftPrefix);
}

function getScopePathPrefix(scopePath: string): string {
  return scopePath
    .replace(/\\/g, "/")
    .replace(/\/?\*\*.*$/, "")
    .replace(/\/?\*.*$/, "")
    .replace(/\/+$/, "");
}

function isSameOrChildPath(parent: string, child: string): boolean {
  return parent === child || Boolean(parent && child.startsWith(`${parent}/`));
}

async function getCloseoutWorktreeFindings(
  repoRoot: string,
  tasks: Task[],
  task: Task,
): Promise<CloseoutFinding[]> {
  const files = await getWorktreeConflictFiles(repoRoot, tasks, task);
  return files.map((file) => ({
    code: toWorktreeDiagnosticCode(file.classification),
    severity: "warning",
    message: `dirty worktree file ${file.path} is ${file.classification} for task ${task.id}`,
    path: file.path,
    reason: file.reason,
    classification: file.classification,
  }));
}

async function getWorktreeConflictFiles(
  repoRoot: string,
  tasks: Task[],
  task: Task,
): Promise<WorktreeStatusFile[]> {
  try {
    const payload = await getWorktreeStatusPayload({ repoRoot, tasks, taskId: task.id });
    return payload.files.filter((file) => file.classification !== "non_blocking");
  } catch {
    return [];
  }
}

function toWorktreeDoctorDiagnostic(
  repoRoot: string,
  task: Task,
  file: WorktreeStatusFile,
): DoctorDiagnostic {
  return {
    code: toWorktreeDiagnosticCode(file.classification),
    severity: "warning",
    message: `dirty worktree file ${file.path} is ${file.classification} for active task ${task.id}`,
    taskId: task.id,
    sourcePath: path.join(repoRoot, file.path),
    repairHint: getWorktreeRepairHint(file),
    reason: file.reason,
    classification: file.classification,
  };
}

function toWorktreeDiagnosticCode(classification: WorktreeStatusFile["classification"]) {
  return `dirty_worktree_${classification}`;
}

function getWorktreeRepairHint(file: WorktreeStatusFile) {
  return file.classification === "blocking"
    ? "Finish, commit, stash, or revert this task-scoped change before moving on."
    : "Review this dirty file before closing or continuing the active task.";
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
