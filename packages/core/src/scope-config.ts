import { promises as fs } from "node:fs";
import path from "node:path";
import { loadTasks } from "./task-files.ts";
import { TaskWriteError, type Task } from "./types.ts";

export interface ProjectConfigEntry {
  id: string;
  label: string;
  description?: string;
  paths: string[];
}

export type ScopeConfigEntry = ProjectConfigEntry;

export interface ProjectConfig {
  version: 1;
  projects: ProjectConfigEntry[];
  scopes: ProjectConfigEntry[];
}

export type ScopeConfig = ProjectConfig;

export interface ScopeConfigReadResult {
  exists: boolean;
  sourcePath: string;
  source: "preferred" | "legacy" | "missing";
  legacySourcePath?: string;
  config: ScopeConfig;
}

export interface ScopeConfigAddInput {
  id: string;
  label: string;
  paths: string[];
}

const projectConfigRelativePath = path.join(".forge", "projects.yml");
const scopeConfigRelativePath = path.join(".forge", "scopes.yml");
const scopeIdPattern = /^[a-z][a-z0-9-]*$/;

export async function readScopeConfig(repoRoot: string): Promise<ScopeConfigReadResult> {
  const preferredPath = getProjectConfigPath(repoRoot);
  const legacyPath = getScopeConfigPath(repoRoot);
  const legacyExists = await fileExists(legacyPath);

  try {
    const config = parseScopeConfig(await fs.readFile(preferredPath, "utf8"), preferredPath);
    return {
      exists: true,
      source: "preferred",
      sourcePath: preferredPath,
      legacySourcePath: legacyExists ? legacyPath : undefined,
      config,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      if (legacyExists) {
        const config = parseScopeConfig(await fs.readFile(legacyPath, "utf8"), legacyPath);
        return { exists: true, source: "legacy", sourcePath: legacyPath, config };
      }
      return {
        exists: false,
        source: "missing",
        sourcePath: preferredPath,
        config: createProjectConfig([]),
      };
    }
    throw error;
  }
}

export async function addScopeConfigEntry(
  repoRoot: string,
  input: ScopeConfigAddInput,
): Promise<ScopeConfigReadResult> {
  const result = await readScopeConfig(repoRoot);
  assertValidScopeId(input.id);
  assertNonEmpty(input.label, "label");
  assertNonEmptyPaths(input.paths);
  if (result.config.projects.some((project) => project.id === input.id)) {
    throw new TaskWriteError(`scope id already exists: ${input.id}`);
  }

  const config = createProjectConfig([
    ...result.config.projects,
    { id: input.id, label: input.label, paths: input.paths },
  ]);
  const sourcePath = getProjectConfigPath(repoRoot);
  validateScopeConfig(config, sourcePath);
  await writeScopeConfig(sourcePath, config);
  return { exists: true, source: "preferred", sourcePath, config };
}

export async function updateScopeConfigEntry(
  repoRoot: string,
  id: string,
  paths: string[],
): Promise<ScopeConfigReadResult> {
  const result = await readScopeConfig(repoRoot);
  assertValidScopeId(id);
  assertNonEmptyPaths(paths);
  const project = result.config.projects.find((candidate) => candidate.id === id);
  if (!project) {
    throw new TaskWriteError(`scope id not found: ${id}`);
  }

  project.paths = Array.from(new Set([...project.paths, ...paths]));
  result.config.scopes = result.config.projects;
  const sourcePath = getProjectConfigPath(repoRoot);
  validateScopeConfig(result.config, sourcePath);
  await writeScopeConfig(sourcePath, result.config);
  return { exists: true, source: "preferred", sourcePath, config: result.config };
}

export async function removeScopeConfigEntry(
  repoRoot: string,
  id: string,
): Promise<ScopeConfigReadResult> {
  const result = await readScopeConfig(repoRoot);
  assertValidScopeId(id);
  const projects = result.config.projects.filter((candidate) => candidate.id !== id);
  if (projects.length === result.config.projects.length) {
    throw new TaskWriteError(`scope id not found: ${id}`);
  }

  const config = createProjectConfig(projects);
  const sourcePath = getProjectConfigPath(repoRoot);
  validateScopeConfig(config, sourcePath);
  await writeScopeConfig(sourcePath, config);
  return { exists: true, source: "preferred", sourcePath, config };
}

export async function inferScopeConfigEntries(repoRoot: string): Promise<ScopeConfigEntry[]> {
  return inferScopeConfigEntriesFromTasks(
    await loadTasks(repoRoot, { includeArchive: false }),
  );
}

export function inferScopeConfigEntriesFromTasks(tasks: Task[]): ScopeConfigEntry[] {
  const pathsByLabel = new Map<string, Set<string>>();

  for (const task of tasks) {
    for (const scopePath of task.scope) {
      const label = inferScopeLabel(scopePath);
      if (!label) {
        continue;
      }
      pathsByLabel.set(label, pathsByLabel.get(label) ?? new Set());
      pathsByLabel.get(label)?.add(scopePath);
    }
  }

  return Array.from(pathsByLabel.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, paths]) => ({
      id: slugifyScopeId(label),
      label,
      paths: Array.from(paths).sort((left, right) => left.localeCompare(right)),
    }));
}

export function parseScopeConfig(contents: string, sourcePath = scopeConfigRelativePath): ScopeConfig {
  const lines = contents.split(/\r?\n/);
  const versionLine = lines.find((line) => line.trim().startsWith("version:"));
  if (!versionLine || versionLine.split(":").slice(1).join(":").trim() !== "1") {
    throw new TaskWriteError(`${sourcePath}: scopes.yml version must be 1`);
  }

  const projects: ProjectConfigEntry[] = [];
  let current: ProjectConfigEntry | null = null;
  let readingPaths = false;
  let readingEntries = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("version:")) {
      continue;
    }
    if (line === "projects:" || line === "scopes:") {
      readingEntries = true;
      readingPaths = false;
      continue;
    }
    if (readingEntries && line.startsWith("- id:")) {
      current = { id: unquoteYamlValue(afterColon(line)), label: "", paths: [] };
      projects.push(current);
      readingPaths = false;
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("label:")) {
      current.label = unquoteYamlValue(afterColon(line));
      readingPaths = false;
    } else if (line.startsWith("description:")) {
      current.description = unquoteYamlValue(afterColon(line));
      readingPaths = false;
    } else if (line.startsWith("paths:")) {
      const value = afterColon(line);
      current.paths = value ? parseInlineStringArray(value) : current.paths;
      readingPaths = !value;
    } else if (readingPaths && line.startsWith("- ")) {
      current.paths.push(unquoteYamlValue(line.slice(2).trim()));
    }
  }

  const config = createProjectConfig(projects);
  validateScopeConfig(config, sourcePath);
  return config;
}

function inferScopeLabel(scope: string): string | null {
  const parts = normalizeScopeParts(scope);
  if (parts.length === 0) {
    return null;
  }
  const [first, second, third] = parts;
  if (first === "packages" && second) {
    return joinScopeParts(first, second);
  }
  if (first === "apps" && second) {
    return joinScopeParts(first, second);
  }
  if (first === "lib" && second && third) {
    return joinScopeParts(first, second, third);
  }
  if (first === "product" && second) {
    return joinScopeParts(first, second);
  }
  if (first.startsWith(".")) {
    return first;
  }
  if (["docs", "scripts", "src", "test", "tests"].includes(first)) {
    return first;
  }
  return null;
}

function validateScopeConfig(config: ScopeConfig, sourcePath: string): void {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const scope of config.projects) {
    assertValidScopeId(scope.id, sourcePath);
    assertNonEmpty(scope.label, "label", sourcePath);
    assertNonEmptyPaths(scope.paths, sourcePath);
    if (ids.has(scope.id)) {
      throw new TaskWriteError(`${sourcePath}: duplicate scope id ${scope.id}`);
    }
    ids.add(scope.id);

    for (const scopePath of scope.paths) {
      if (paths.has(scopePath)) {
        throw new TaskWriteError(`${sourcePath}: duplicate scope path ${scopePath}`);
      }
      paths.add(scopePath);
    }
  }
}

async function writeScopeConfig(sourcePath: string, config: ScopeConfig): Promise<void> {
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.writeFile(sourcePath, formatScopeConfig(config));
}

function formatScopeConfig(config: ScopeConfig): string {
  return [
    "version: 1",
    "projects:",
    ...config.projects.flatMap(formatScopeConfigEntry),
    "",
  ].join("\n");
}

function formatScopeConfigEntry(scope: ScopeConfigEntry): string[] {
  return [
    `  - id: ${scope.id}`,
    `    label: ${quoteYamlString(scope.label)}`,
    ...(scope.description ? [`    description: ${quoteYamlString(scope.description)}`] : []),
    "    paths:",
    ...scope.paths.map((scopePath) => `      - ${quoteYamlString(scopePath)}`),
  ];
}

function normalizeScopeParts(scope: string): string[] {
  return scope
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "**")
    .filter((part) => !part.includes("*"))
    .filter((part) => !isFileLike(part));
}

function parseInlineStringArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [unquoteYamlValue(trimmed)];
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner.split(",").map((item) => unquoteYamlValue(item.trim()));
}

function assertValidScopeId(id: string, sourcePath = scopeConfigRelativePath): void {
  if (!scopeIdPattern.test(id)) {
    throw new TaskWriteError(`${sourcePath}: invalid scope id ${id}`);
  }
}

function assertNonEmpty(value: string, field: string, sourcePath = scopeConfigRelativePath): void {
  if (!value.trim()) {
    throw new TaskWriteError(`${sourcePath}: scope ${field} must not be empty`);
  }
}

function assertNonEmptyPaths(paths: string[], sourcePath = scopeConfigRelativePath): void {
  if (paths.length === 0 || paths.some((scopePath) => !scopePath.trim())) {
    throw new TaskWriteError(`${sourcePath}: scope paths must not be empty`);
  }
}

function quoteYamlString(value: string) {
  return JSON.stringify(value);
}

function unquoteYamlValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function afterColon(line: string) {
  return line.split(":").slice(1).join(":").trim();
}

function slugifyScopeId(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function joinScopeParts(...parts: string[]) {
  return parts.join("/");
}

function isFileLike(part: string) {
  return /^[^.].*\.[a-z0-9]+$/i.test(part);
}

export function getScopeConfigPath(repoRoot: string): string {
  return path.join(repoRoot, scopeConfigRelativePath);
}

export function getProjectConfigPath(repoRoot: string): string {
  return path.join(repoRoot, projectConfigRelativePath);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function createProjectConfig(projects: ProjectConfigEntry[]): ProjectConfig {
  return { version: 1, projects, scopes: projects };
}
