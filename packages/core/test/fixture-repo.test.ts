import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { TaskParseError, loadTasksFrom } from "../src";
import {
  blockedForgeFixtureTasks,
  claimedForgeFixtureTasks,
  createForgeFixtureRepo,
  createForgeFixtureWorkspace,
  doneForgeFixtureTasks,
  legacyForgeFixtureTasks,
  minimalForgeFixtureTasks,
  scaleForgeFixtureTasks,
  type ForgeFixtureRepo,
  type ForgeFixtureWorkspace,
} from "./fixture-repo";

const fixtureRepos: ForgeFixtureRepo[] = [];
const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];

afterEach(async () => {
  await Promise.all([
    ...fixtureRepos.splice(0).map((repo) => repo.cleanup()),
    ...fixtureWorkspaces.splice(0).map((workspace) => workspace.cleanup()),
  ]);
});

async function makeRepo(tasks = minimalForgeFixtureTasks()): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({ tasks });
  fixtureRepos.push(repo);
  return repo;
}

async function makeWorkspace(
  roots: Parameters<typeof createForgeFixtureWorkspace>[0]["roots"] = [],
): Promise<ForgeFixtureWorkspace> {
  const workspace = await createForgeFixtureWorkspace({ roots });
  fixtureWorkspaces.push(workspace);
  return workspace;
}

describe("Forge fixture repo builder", () => {
  test("creates disposable repos with a nested working directory", async () => {
    const repo = await makeRepo();

    expect(await fs.stat(path.join(repo.repoRoot, ".forge", "tasks"))).toBeDefined();
    expect(repo.nestedDir.endsWith(path.join("packages", "core", "src"))).toBe(true);
    expect((await loadTasksFrom(repo.nestedDir)).map((task) => task.id)).toEqual(["F-0001"]);
  });

  test("covers blocked, claimed, done, and legacy optional-field task shapes", async () => {
    const repo = await makeRepo([
      ...blockedForgeFixtureTasks(),
      ...claimedForgeFixtureTasks(),
      ...doneForgeFixtureTasks(),
      ...legacyForgeFixtureTasks(),
    ]);

    const tasks = await loadTasksFrom(repo.repoRoot);
    const byId = new Map(tasks.map((task) => [task.id, task]));

    expect(byId.get("F-0102")?.depends_on).toEqual(["F-0101"]);
    expect(byId.get("F-0201")?.claimed_by).toBe("codex");
    expect(byId.get("F-0301")).toMatchObject({
      status: "done",
      closed_at: "2026-05-15T06:00:00.000Z",
      close_reason: "Fixture completed",
    });
    expect(byId.get("F-0401")).toMatchObject({
      status: "open",
      closed_at: undefined,
      close_reason: undefined,
    });
  });
});

describe("Forge workspace fixture builder", () => {
  test("creates disposable parent workspaces with zero Forge roots", async () => {
    const workspace = await makeWorkspace();

    expect(workspace.roots).toEqual([]);
    expect(await fs.stat(workspace.workspaceRoot)).toBeDefined();

    await workspace.cleanup();
    fixtureWorkspaces.splice(fixtureWorkspaces.indexOf(workspace), 1);
    await expect(fs.stat(workspace.workspaceRoot)).rejects.toThrow();
  });

  test("composes one-root and many-root workspaces with predictable tasks", async () => {
    const workspace = await makeWorkspace([
      { name: "api", tasks: [{ id: "F-1001", title: "API task", area: "api" }] },
      { name: "web", tasks: [{ id: "F-1001", title: "Web task", area: "web" }] },
    ]);

    expect(workspace.roots.map((repo) => path.basename(repo.repoRoot))).toEqual(["api", "web"]);
    await expect(loadTasksFrom(workspace.roots[0].repoRoot)).resolves.toMatchObject([
      { id: "F-1001", area: "api" },
    ]);
    await expect(loadTasksFrom(workspace.roots[1].repoRoot)).resolves.toMatchObject([
      { id: "F-1001", area: "web" },
    ]);
  });

  test("supports empty roots, malformed files, ignored roots, and large task sets", async () => {
    const workspace = await makeWorkspace([
      { name: "empty", tasks: [] },
      {
        name: "malformed",
        malformedFiles: [{ filename: "bad.md", contents: "---\nid: [\n---\n" }],
      },
      { name: "large", tasks: scaleForgeFixtureTasks(1000) },
    ]);
    const ignoredRoot = await workspace.writeIgnoredRoot(
      ["node_modules", "fixture-package"],
      [{ id: "F-9999", title: "Ignored nested root" }],
    );

    await expect(loadTasksFrom(workspace.roots[0].repoRoot)).resolves.toEqual([]);
    await expect(loadTasksFrom(workspace.roots[1].repoRoot)).rejects.toBeInstanceOf(
      TaskParseError,
    );
    await expect(loadTasksFrom(workspace.roots[2].repoRoot)).resolves.toHaveLength(1000);
    expect(ignoredRoot).toContain(path.join("node_modules", "fixture-package"));
    expect(await fs.stat(path.join(ignoredRoot, ".forge", "tasks"))).toBeDefined();
  });
});
