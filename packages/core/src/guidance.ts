import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  TaskParseError,
  type GuidanceBundle,
  type GuidanceDiagnostic,
  type GuidanceMatch,
  type ResolveGuidanceInput,
} from "./types.ts";
import { findForgeRoot, findParsedTaskById } from "./task-files.ts";

export async function resolveGuidance(
  input: ResolveGuidanceInput = {},
): Promise<GuidanceBundle> {
  const repoRoot = await findForgeRoot(input.cwd ?? process.cwd());
  const context = await buildGuidanceContext(repoRoot, input);
  const diagnostics: GuidanceDiagnostic[] = [];
  const config = await readGuidanceConfig(repoRoot, diagnostics);
  const matches: GuidanceMatch[] = [];
  const seenPaths = new Set<string>();

  if (config) {
    for (const route of config.routes) {
      if (!guidanceRouteMatches(route, context)) {
        continue;
      }
      await addGuidanceMatch(
        repoRoot,
        route.include,
        getGuidanceRouteReasons(route, context),
        Boolean(input.includeContent),
        matches,
        seenPaths,
        diagnostics,
      );
    }
  }

  await addLocalGuidanceMatch(
    repoRoot,
    Boolean(input.includeContent),
    matches,
    seenPaths,
  );

  return { repoRoot, matches, diagnostics };
}

export async function inspectGuidanceConfig(
  repoRoot: string,
): Promise<GuidanceDiagnostic[]> {
  const diagnostics: GuidanceDiagnostic[] = [];
  const config = await readGuidanceConfig(repoRoot, diagnostics, false);
  if (config) {
    diagnostics.push(...(await inspectGuidanceIncludes(repoRoot, config)));
  }
  diagnostics.push(...(await inspectLocalGuidanceFiles(repoRoot)));
  return diagnostics;
}

interface GuidanceConfig {
  version: 1;
  routes: GuidanceRoute[];
}

interface GuidanceRoute {
  include: string;
  when: GuidanceRouteConditions;
}

interface GuidanceRouteConditions {
  area?: string[];
  scope?: string[];
  path?: string[];
  cwd?: string[];
}

interface GuidanceContext {
  cwd: string;
  area: string | null;
  scope: string[];
  paths: string[];
}

async function buildGuidanceContext(
  repoRoot: string,
  input: ResolveGuidanceInput,
): Promise<GuidanceContext> {
  const task = input.taskId ? (await findParsedTaskById(repoRoot, input.taskId)).task : null;
  return {
    cwd: normalizeRepoPath(path.relative(repoRoot, path.resolve(input.cwd ?? repoRoot))),
    area: task?.area ?? null,
    scope: task?.scope ?? [],
    paths: (input.paths ?? []).map((inputPath) =>
      normalizeRepoPath(path.relative(repoRoot, path.resolve(repoRoot, inputPath))),
    ),
  };
}

async function readGuidanceConfig(
  repoRoot: string,
  diagnostics: GuidanceDiagnostic[],
  reportMissing = true,
): Promise<GuidanceConfig | null> {
  const configPath = path.join(repoRoot, ".forge", "guidance.yml");
  let contents: string;
  try {
    contents = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) {
      if (reportMissing) {
        diagnostics.push({
          kind: "missing_config",
          message: "no .forge/guidance.yml found",
          path: ".forge/guidance.yml",
        });
      }
      return null;
    }
    throw error;
  }

  try {
    const parsed = matter(`---\n${contents}\n---\n`);
    return validateGuidanceConfig(parsed.data as Record<string, unknown>, configPath);
  } catch (error) {
    diagnostics.push({
      kind: "invalid_config",
      message: error instanceof Error ? error.message : String(error),
      path: ".forge/guidance.yml",
    });
    return null;
  }
}

function validateGuidanceConfig(
  raw: Record<string, unknown>,
  sourcePath: string,
): GuidanceConfig {
  if (raw.version !== 1) {
    throw new TaskParseError(sourcePath, 'field "version" must be 1');
  }
  if (!Array.isArray(raw.routes)) {
    throw new TaskParseError(sourcePath, 'field "routes" must be an array');
  }

  return {
    version: 1,
    routes: raw.routes.map((route, index) =>
      validateGuidanceRoute(route, sourcePath, index),
    ),
  };
}

function validateGuidanceRoute(
  raw: unknown,
  sourcePath: string,
  index: number,
): GuidanceRoute {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TaskParseError(sourcePath, `route ${index} must be an object`);
  }
  const route = raw as Record<string, unknown>;
  if (typeof route.include !== "string" || !route.include.trim()) {
    throw new TaskParseError(sourcePath, `route ${index} field "include" must be a string`);
  }

  return {
    include: normalizeRepoPath(route.include),
    when: validateGuidanceConditions(route.when, sourcePath, index),
  };
}

function validateGuidanceConditions(
  raw: unknown,
  sourcePath: string,
  index: number,
): GuidanceRouteConditions {
  if (raw === undefined) {
    return {};
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TaskParseError(sourcePath, `route ${index} field "when" must be an object`);
  }
  const conditions = raw as Record<string, unknown>;
  return {
    area: optionalStringArray(conditions.area, sourcePath, `route ${index} when.area`),
    scope: optionalStringArray(conditions.scope, sourcePath, `route ${index} when.scope`),
    path: optionalStringArray(conditions.path, sourcePath, `route ${index} when.path`),
    cwd: optionalStringArray(conditions.cwd, sourcePath, `route ${index} when.cwd`),
  };
}

function optionalStringArray(
  raw: unknown,
  sourcePath: string,
  field: string,
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string")) {
    throw new TaskParseError(sourcePath, `field "${field}" must be an array of strings`);
  }
  return raw.map((value) => normalizeRepoPath(value));
}

function guidanceRouteMatches(
  route: GuidanceRoute,
  context: GuidanceContext,
): boolean {
  return (
    matchesArea(route.when.area, context) &&
    matchesAnyGlob(route.when.scope, context.scope) &&
    matchesAnyGlob(route.when.path, context.paths) &&
    matchesAnyGlob(route.when.cwd, [context.cwd])
  );
}

function matchesArea(patterns: string[] | undefined, context: GuidanceContext): boolean {
  if (!patterns) {
    return true;
  }
  return context.area ? patterns.includes(context.area) : false;
}

function matchesAnyGlob(patterns: string[] | undefined, values: string[]): boolean {
  if (!patterns) {
    return true;
  }
  return values.some((value) => patterns.some((pattern) => globMatches(pattern, value)));
}

function getGuidanceRouteReasons(
  route: GuidanceRoute,
  context: GuidanceContext,
): string[] {
  const reasons: string[] = [];
  if (route.when.area && context.area && route.when.area.includes(context.area)) {
    reasons.push(`area:${context.area}`);
  }
  for (const scope of context.scope) {
    if (route.when.scope?.some((pattern) => globMatches(pattern, scope))) {
      reasons.push(`scope:${scope}`);
      break;
    }
  }
  for (const explicitPath of context.paths) {
    if (route.when.path?.some((pattern) => globMatches(pattern, explicitPath))) {
      reasons.push(`path:${explicitPath}`);
      break;
    }
  }
  if (route.when.cwd?.some((pattern) => globMatches(pattern, context.cwd))) {
    reasons.push(`cwd:${context.cwd}`);
  }
  return reasons.length ? reasons : ["always"];
}

async function addGuidanceMatch(
  repoRoot: string,
  includePath: string,
  reasons: string[],
  includeContent: boolean,
  matches: GuidanceMatch[],
  seenPaths: Set<string>,
  diagnostics: GuidanceDiagnostic[],
): Promise<void> {
  const normalizedPath = normalizeRepoPath(includePath);
  if (seenPaths.has(normalizedPath)) {
    return;
  }
  seenPaths.add(normalizedPath);

  const sourcePath = path.join(repoRoot, ".forge", normalizedPath);
  let content: string;
  try {
    content = await fs.readFile(sourcePath, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) {
      diagnostics.push({
        kind: "missing_include",
        message: `guidance include not found: ${normalizedPath}`,
        path: normalizedPath,
      });
      return;
    }
    throw error;
  }

  matches.push({
    path: normalizedPath,
    sourcePath,
    reasons,
    promptSummary: extractPromptSummary(content),
    ...(includeContent ? { content } : {}),
  });
}

async function addLocalGuidanceMatch(
  repoRoot: string,
  includeContent: boolean,
  matches: GuidanceMatch[],
  seenPaths: Set<string>,
): Promise<void> {
  const localPath = "local/user.md";
  if (seenPaths.has(localPath)) {
    return;
  }

  const sourcePath = path.join(repoRoot, ".forge", localPath);
  let content: string;
  try {
    content = await fs.readFile(sourcePath, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }

  seenPaths.add(localPath);
  matches.push({
    path: localPath,
    sourcePath,
    reasons: ["local"],
    promptSummary: extractPromptSummary(content),
    ...(includeContent ? { content } : {}),
  });
}

async function inspectGuidanceIncludes(
  repoRoot: string,
  config: GuidanceConfig,
): Promise<GuidanceDiagnostic[]> {
  const diagnostics: GuidanceDiagnostic[] = [];
  const seenRouteKeys = new Set<string>();
  const seenIncludePaths = new Set<string>();

  for (const route of config.routes) {
    const routeKey = `${route.include}\n${JSON.stringify(route.when)}`;
    if (seenRouteKeys.has(routeKey)) {
      diagnostics.push({
        kind: "duplicate_include",
        message: `duplicate guidance include route: ${route.include}`,
        path: route.include,
      });
    }
    seenRouteKeys.add(routeKey);

    if (seenIncludePaths.has(route.include)) {
      continue;
    }
    seenIncludePaths.add(route.include);
    diagnostics.push(...(await inspectGuidanceInclude(repoRoot, route.include)));
  }

  return diagnostics;
}

async function inspectGuidanceInclude(
  repoRoot: string,
  includePath: string,
): Promise<GuidanceDiagnostic[]> {
  const sourcePath = path.join(repoRoot, ".forge", includePath);
  try {
    await fs.readFile(sourcePath, "utf8");
    return [];
  } catch (error) {
    if (isNotFoundError(error)) {
      return [
        {
          kind: "missing_include",
          message: `guidance include not found: ${includePath}`,
          path: includePath,
        },
      ];
    }

    return [
      {
        kind: "unreadable_include",
        message: `guidance include is unreadable: ${includePath}`,
        path: includePath,
      },
    ];
  }
}

async function inspectLocalGuidanceFiles(repoRoot: string): Promise<GuidanceDiagnostic[]> {
  const localDir = path.join(repoRoot, ".forge", "local");
  const localFiles = await listFilesIfExists(localDir);
  if (localFiles.length === 0 || (await gitignoreMentionsForgeLocal(repoRoot))) {
    return [];
  }

  return localFiles.map((sourcePath) => {
    const localPath = normalizeRepoPath(path.relative(path.join(repoRoot, ".forge"), sourcePath));
    return {
      kind: "local_file_not_ignored" as const,
      message: `.forge/${localPath} is local-only; add .forge/local/** to .gitignore before committing`,
      path: localPath,
    };
  });
}

async function listFilesIfExists(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  return (
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return listFilesIfExists(entryPath);
        }
        return entry.isFile() ? [entryPath] : [];
      }),
    )
  )
    .flat()
    .sort();
}

async function gitignoreMentionsForgeLocal(repoRoot: string): Promise<boolean> {
  try {
    const contents = await fs.readFile(path.join(repoRoot, ".gitignore"), "utf8");
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .some((line) => line === ".forge/local/**" || line === ".forge/local/");
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

function extractPromptSummary(content: string): string | null {
  const match = /^##\s+Prompt Summary\s*$/im.exec(content);
  if (!match) {
    return null;
  }

  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = /^##\s+/m.exec(rest);
  const summary = rest.slice(0, nextHeading?.index ?? rest.length).trim();
  return summary || null;
}

function normalizeRepoPath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "");
  return normalized === "" ? "." : normalized;
}

function globMatches(pattern: string, value: string): boolean {
  return globToRegExp(pattern).test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
