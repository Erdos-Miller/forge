import path from "node:path";
import {
  createTaskFrom,
  findForgeRoot,
  loadTasksFrom,
  readScopeConfig,
  type ProjectConfigEntry,
  type Task,
} from "@forge/core";
import { parseCreateArgs } from "./args";
import { stringifyJson, toRobotTaskDocument } from "./robot";
import type { CliOptions } from "./index";

export async function create(options: CliOptions, args: string[]): Promise<number> {
  const parsed = parseCreateArgs(args);
  const repoRoot = await findForgeRoot(options.cwd);
  const tasks = await loadTasksFrom(repoRoot);
  const input = { ...parsed.input };
  const projectResolution = await resolveCreateProject(
    repoRoot,
    options.cwd,
    input.project,
    parsed.explicitProject,
  );
  input.project = projectResolution.project;
  if (!input.id) {
    input.id = getNextTaskId(tasks);
  }

  const task = await createTaskFrom(repoRoot, input, options.now);
  if (parsed.json) {
    options.stdout(
      stringifyJson({
        ok: true,
        version: 1,
        task: toRobotTaskDocument(task),
        project: {
          value: task.project ?? null,
          source: projectResolution.source,
        },
      }),
    );
    return 0;
  }
  options.stdout(`created ${task.id} ${task.sourcePath}`);
  return 0;
}

async function resolveCreateProject(
  repoRoot: string,
  cwd: string,
  explicitProject: string | undefined,
  hasExplicitProject: boolean,
): Promise<{ project: string | undefined; source: "explicit" | "inferred" | "unset" }> {
  const projectConfig = await readScopeConfig(repoRoot);
  if (hasExplicitProject) {
    validateCreateProjectId(explicitProject);
    if (
      projectConfig.exists &&
      !projectConfig.config.projects.some((project) => project.id === explicitProject)
    ) {
      throw new Error(`unknown project ${explicitProject}`);
    }
    return { project: explicitProject, source: "explicit" };
  }

  if (!projectConfig.exists) {
    return { project: undefined, source: "unset" };
  }

  const matches = projectConfig.config.projects.filter((project) =>
    cwdMatchesProject(repoRoot, cwd, project),
  );
  if (matches.length === 0) {
    return { project: undefined, source: "unset" };
  }
  if (matches.length > 1) {
    throw new Error(
      `cwd matches multiple Projects: ${matches.map((project) => project.id).join(", ")}`,
    );
  }
  return { project: matches[0].id, source: "inferred" };
}

function validateCreateProjectId(projectId: string | undefined): asserts projectId is string {
  if (!projectId || !/^[a-z][a-z0-9-]*$/.test(projectId)) {
    throw new Error("project must match /^[a-z][a-z0-9-]*$/");
  }
}

function cwdMatchesProject(repoRoot: string, cwd: string, project: ProjectConfigEntry): boolean {
  const relativeCwd = normalizePath(path.relative(repoRoot, cwd)) || ".";
  return project.paths.some((projectPath) => pathMatchesProjectPath(relativeCwd, projectPath));
}

function pathMatchesProjectPath(relativeCwd: string, projectPath: string): boolean {
  const prefix = getProjectPathPrefix(projectPath);
  return prefix === "." || relativeCwd === prefix || relativeCwd.startsWith(`${prefix}/`);
}

function getProjectPathPrefix(projectPath: string): string {
  return (
    normalizePath(projectPath)
      .replace(/\/?\*\*.*$/, "")
      .replace(/\/?\*.*$/, "")
      .replace(/\/+$/, "") || "."
  );
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").split(path.sep).join("/");
}

function getNextTaskId(tasks: Task[]): string {
  const maxId = tasks.reduce((max, task) => {
    const match = /^F-(\d+)$/.exec(task.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `F-${String(maxId + 1).padStart(4, "0")}`;
}
