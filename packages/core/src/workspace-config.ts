import { promises as fs } from "node:fs";
import path from "node:path";
import { TaskWriteError } from "./types.ts";

export interface WorkspaceDiscoveryConfig {
  version: 1;
  discovery: {
    ignore: string[];
  };
}

export interface WorkspaceDiscoveryConfigReadResult {
  exists: boolean;
  sourcePath: string;
  config: WorkspaceDiscoveryConfig;
}

export interface WorkspaceDiscoveryConfigDiagnostic {
  code: string;
  message: string;
  sourcePath: string;
  path?: string;
  repairHint: string;
}

export async function readWorkspaceDiscoveryConfig(
  startDir: string,
): Promise<WorkspaceDiscoveryConfigReadResult> {
  const sourcePath = getWorkspaceConfigPath(startDir);
  try {
    const config = parseWorkspaceDiscoveryConfig(
      await fs.readFile(sourcePath, "utf8"),
      sourcePath,
    );
    return { exists: true, sourcePath, config };
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return { exists: false, sourcePath, config: emptyWorkspaceDiscoveryConfig() };
    }
    throw error;
  }
}

export async function getWorkspaceDiscoveryConfigDiagnostics(
  startDir: string,
): Promise<WorkspaceDiscoveryConfigDiagnostic[]> {
  const sourcePath = getWorkspaceConfigPath(startDir);
  try {
    await readWorkspaceDiscoveryConfig(startDir);
    return [];
  } catch (error) {
    return [
      {
        code: "workspace_config_invalid",
        message: error instanceof Error ? error.message : String(error),
        sourcePath,
        repairHint:
          "Use version: 1 with discovery.ignore entries that are relative paths.",
      },
    ];
  }
}

export function parseWorkspaceDiscoveryConfig(
  contents: string,
  sourcePath = "forge.workspace.yml",
): WorkspaceDiscoveryConfig {
  const lines = contents.split(/\r?\n/);
  const versionLine = lines.find((line) => line.trim().startsWith("version:"));
  if (!versionLine || afterColon(versionLine) !== "1") {
    throw new TaskWriteError(`${sourcePath}: workspace config version must be 1`);
  }

  const ignore: string[] = [];
  let readingIgnore = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line === "discovery:" || line.startsWith("version:")) {
      continue;
    }
    if (line.startsWith("ignore:")) {
      readingIgnore = true;
      continue;
    }
    if (readingIgnore && line.startsWith("- ")) {
      ignore.push(unquoteYamlValue(line.slice(2).trim()));
    }
  }

  const config = { version: 1 as const, discovery: { ignore } };
  validateWorkspaceDiscoveryConfig(config, sourcePath);
  return config;
}

export function matchesWorkspaceIgnorePattern(relativePath: string, pattern: string): boolean {
  const normalizedPath = normalizeConfigPath(relativePath);
  const normalizedPattern = normalizeConfigPath(pattern).replace(/\/\*\*$/, "");
  return (
    normalizedPath === normalizedPattern ||
    normalizedPath.startsWith(`${normalizedPattern}/`)
  );
}

function validateWorkspaceDiscoveryConfig(
  config: WorkspaceDiscoveryConfig,
  sourcePath: string,
): void {
  const seen = new Set<string>();
  for (const ignorePath of config.discovery.ignore) {
    assertValidIgnorePath(ignorePath, sourcePath);
    const normalized = normalizeConfigPath(ignorePath);
    if (seen.has(normalized)) {
      throw new TaskWriteError(`${sourcePath}: duplicate ignore path ${ignorePath}`);
    }
    seen.add(normalized);
  }
}

function assertValidIgnorePath(ignorePath: string, sourcePath: string): void {
  const normalized = normalizeConfigPath(ignorePath);
  if (!normalized || path.isAbsolute(ignorePath) || normalized.split("/").includes("..")) {
    throw new TaskWriteError(`${sourcePath}: invalid ignore path ${ignorePath}`);
  }
}

function normalizeConfigPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function getWorkspaceConfigPath(startDir: string): string {
  return path.join(startDir, "forge.workspace.yml");
}

function emptyWorkspaceDiscoveryConfig(): WorkspaceDiscoveryConfig {
  return { version: 1, discovery: { ignore: [] } };
}

function afterColon(line: string): string {
  return line.split(":").slice(1).join(":").trim();
}

function unquoteYamlValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
