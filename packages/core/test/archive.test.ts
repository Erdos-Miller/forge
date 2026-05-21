import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createForgeFixtureRepo,
  createForgeFixtureTaskFile,
  type ForgeFixtureRepo,
} from "./fixture-repo";
import { analyzeTasks, getClosedTaskArchivePlan, loadTasks } from "../src";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

describe("closed task archive loading", () => {
  test("loads active tasks and archived closed tasks by default", async () => {
    const repo = await makeRepo();
    await writeArchivedTask(repo, {
      id: "F-0001",
      title: "Archived done",
      status: "done",
      closed_at: "2026-05-15T01:00:00-05:00",
    });

    expect((await loadTasks(repo.repoRoot)).map((task) => task.id)).toEqual([
      "F-0001",
      "F-0002",
    ]);
    expect((await loadTasks(repo.repoRoot, { includeArchive: false })).map((task) => task.id))
      .toEqual(["F-0002"]);
  });

  test("satisfies dependencies on archived closed tasks", async () => {
    const repo = await makeRepo();
    await writeArchivedTask(repo, {
      id: "F-0001",
      title: "Archived done",
      status: "done",
      closed_at: "2026-05-15T01:00:00-05:00",
    });

    const analysis = analyzeTasks(await loadTasks(repo.repoRoot));

    expect(analysis.missingDependencies).toEqual([]);
    expect(analysis.readyTaskIds).toContain("F-0002");
  });

  test("plans closed task archive moves without mutating files", async () => {
    const repo = await makeRepo();
    const closedPath = await repo.writeTask({
      id: "F-0003",
      title: "Closed active file",
      status: "done",
      closed_at: "2026-05-15T01:00:00-05:00",
    });
    await writeArchivedTask(repo, {
      id: "F-0001",
      title: "Archived done",
      status: "done",
      closed_at: "2026-05-15T01:00:00-05:00",
    });

    const plan = await getClosedTaskArchivePlan(repo.repoRoot);

    expect(plan).toEqual([
      {
        taskId: "F-0003",
        title: "Closed active file",
        status: "done",
        from: closedPath,
        to: path.join(repo.repoRoot, ".forge", "archive", path.basename(closedPath)),
      },
    ]);
    expect(await fs.stat(closedPath)).toBeDefined();
  });
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-archive-",
    tasks: [
      {
        id: "F-0002",
        title: "Active task",
        depends_on: ["F-0001"],
      },
    ],
  });
  fixtureRepos.push(repo);
  return repo;
}

async function writeArchivedTask(
  repo: ForgeFixtureRepo,
  task: Parameters<typeof createForgeFixtureTaskFile>[0],
): Promise<string> {
  const archiveDir = path.join(repo.repoRoot, ".forge", "archive");
  const filePath = path.join(archiveDir, `${task.id}-${task.title}.md`);
  await fs.mkdir(archiveDir, { recursive: true });
  await fs.writeFile(filePath, createForgeFixtureTaskFile(task));
  return filePath;
}
