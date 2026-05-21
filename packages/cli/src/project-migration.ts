import {
  getProjectConfigPath,
  getScopeConfigPath,
  loadTasksFrom,
  readScopeConfig,
  type ProjectConfigEntry,
  type Task,
} from "@forge/core";

interface ProjectTaskSummary {
  taskId: string;
  title: string;
  sourcePath: string;
}

interface ProjectBackfillSuggestion extends ProjectTaskSummary {
  project: string;
  matchedPaths: string[];
}

interface AmbiguousProjectTask extends ProjectTaskSummary {
  projects: string[];
  matchedPaths: string[];
}

interface UnknownTaskProject extends ProjectTaskSummary {
  project: string;
}

interface StaleProjectPath {
  project: string;
  path: string;
}

export async function getProjectMigrationDryRun(repoRoot: string) {
  const [config, tasks] = await Promise.all([readScopeConfig(repoRoot), loadTasksFrom(repoRoot)]);
  const activeTasks = tasks.filter((task) => task.status !== "done" && task.status !== "canceled");
  const projects = config.config.projects;
  const plan = getTaskProjectPlan(activeTasks, projects);

  return {
    ok: true,
    version: 1,
    repoRoot,
    dryRun: true,
    config: {
      exists: config.exists,
      source: config.source,
      sourcePath: config.sourcePath,
      legacySourcePath: config.legacySourcePath ?? null,
      projects,
    },
    migration: {
      steps: getConfigMigrationSteps(repoRoot, config.source, config.legacySourcePath),
    },
    backfill: {
      unambiguous: plan.unambiguous,
      ambiguous: plan.ambiguous,
      noMatch: plan.noMatch,
      alreadySet: plan.alreadySet,
    },
    staleProjectPaths: getStaleProjectPaths(activeTasks, projects),
    unknownTaskProjects: plan.unknownTaskProjects,
  };
}

function getConfigMigrationSteps(
  repoRoot: string,
  source: "preferred" | "legacy" | "missing",
  legacySourcePath: string | undefined,
) {
  if (source === "legacy") {
    return [
      {
        action: "copy_legacy_config",
        from: getScopeConfigPath(repoRoot),
        to: getProjectConfigPath(repoRoot),
      },
    ];
  }
  if (legacySourcePath) {
    return [
      {
        action: "remove_legacy_config",
        from: legacySourcePath,
        to: null,
      },
    ];
  }
  return [];
}

function getTaskProjectPlan(tasks: Task[], projects: ProjectConfigEntry[]) {
  const projectIds = new Set(projects.map((project) => project.id));
  const unambiguous: ProjectBackfillSuggestion[] = [];
  const ambiguous: AmbiguousProjectTask[] = [];
  const noMatch: ProjectTaskSummary[] = [];
  const alreadySet: UnknownTaskProject[] = [];
  const unknownTaskProjects: UnknownTaskProject[] = [];

  for (const task of tasks) {
    if (task.project) {
      const summary = { ...toTaskSummary(task), project: task.project };
      if (projectIds.has(task.project)) {
        alreadySet.push(summary);
      } else {
        unknownTaskProjects.push(summary);
      }
      continue;
    }

    const matches = getProjectMatches(task, projects);
    if (matches.length === 0) {
      noMatch.push(toTaskSummary(task));
    } else if (matches.length === 1) {
      unambiguous.push({
        ...toTaskSummary(task),
        project: matches[0].project.id,
        matchedPaths: matches[0].matchedPaths,
      });
    } else {
      ambiguous.push({
        ...toTaskSummary(task),
        projects: matches.map((match) => match.project.id),
        matchedPaths: matches.flatMap((match) => match.matchedPaths),
      });
    }
  }

  return { unambiguous, ambiguous, noMatch, alreadySet, unknownTaskProjects };
}

function getProjectMatches(task: Task, projects: ProjectConfigEntry[]) {
  return projects
    .map((project) => ({
      project,
      matchedPaths: project.paths.filter((projectPath) =>
        task.scope.some((taskScope) => scopePathsOverlap(projectPath, taskScope)),
      ),
    }))
    .filter((match) => match.matchedPaths.length > 0);
}

function getStaleProjectPaths(tasks: Task[], projects: ProjectConfigEntry[]): StaleProjectPath[] {
  const taskScopes = tasks.flatMap((task) => task.scope);
  return projects.flatMap((project) =>
    project.paths
      .filter(
        (projectPath) =>
          !taskScopes.some((taskScope) => scopePathsOverlap(projectPath, taskScope)),
      )
      .map((projectPath) => ({ project: project.id, path: projectPath })),
  );
}

function toTaskSummary(task: Task): ProjectTaskSummary {
  return {
    taskId: task.id,
    title: task.title,
    sourcePath: task.sourcePath,
  };
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
