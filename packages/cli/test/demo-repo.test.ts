import { afterEach, describe, expect, test } from "bun:test";
import {
  analyzeTasks,
  discoverForgeRootsDownward,
  loadTasksFrom,
  rankReadyTasks,
} from "@forge/core";
import { parseWebArgs } from "../src/args";
import {
  createDemoForgeRepo,
  createDemoForgeWorkspace,
  type DemoForgeRepo,
  type DemoForgeWorkspace,
} from "../src/demo-repo";

const demoRepos: DemoForgeRepo[] = [];
const demoWorkspaces: DemoForgeWorkspace[] = [];

afterEach(async () => {
  await Promise.all(demoRepos.splice(0).map((repo) => repo.cleanup()));
  await Promise.all(demoWorkspaces.splice(0).map((workspace) => workspace.cleanup()));
});

async function makeDemoRepo(): Promise<DemoForgeRepo> {
  const repo = await createDemoForgeRepo();
  demoRepos.push(repo);
  return repo;
}

async function makeDemoWorkspace(): Promise<DemoForgeWorkspace> {
  const workspace = await createDemoForgeWorkspace();
  demoWorkspaces.push(workspace);
  return workspace;
}

describe("web demo mode", () => {
  test("creates a realistic temporary Forge task graph", async () => {
    const repo = await makeDemoRepo();
    const tasks = await loadTasksFrom(repo.repoRoot);
    const analysis = analyzeTasks(tasks);
    const readyTasks = rankReadyTasks(tasks);

    expect(tasks.length).toBeGreaterThanOrEqual(12);
    expect(readyTasks.map((task) => task.id)).toContain("F-1001");
    expect(tasks.some((task) => task.status === "doing")).toBe(true);
    expect(tasks.some((task) => task.status === "blocked")).toBe(true);
    expect(tasks.some((task) => task.status === "done")).toBe(true);
    expect(new Set(tasks.map((task) => task.area)).size).toBeGreaterThanOrEqual(5);
    expect(analysis.missingDependencies).toEqual([]);
    expect(analysis.dependencyCycles).toEqual([]);
  });

  test("creates a multi-root demo workspace for workspace switching", async () => {
    const workspace = await makeDemoWorkspace();
    const roots = await discoverForgeRootsDownward(workspace.workspaceRoot);

    expect(roots.map((root) => root.id)).toEqual(["agent-runtime", "forge-ui"]);
    expect(roots.every((root) => root.taskCount > 0)).toBe(true);
    for (const root of roots) {
      const tasks = await loadTasksFrom(root.path);
      expect(rankReadyTasks(tasks).length).toBeGreaterThan(0);
    }
  });

  test("parses demo web arguments without changing status behavior", () => {
    expect(parseWebArgs(["--demo", "--port", "5190"], "/repo")).toMatchObject({
      action: "serve",
      demo: true,
      port: 5190,
      startDir: "/repo",
    });
    expect(parseWebArgs(["status", "--json"], "/repo")).toEqual({
      action: "status",
      json: true,
      startDir: "/repo",
    });
    expect(() => parseWebArgs(["--demo", "--dir", "/other"], "/repo")).toThrow(
      "web option --demo cannot be combined with --dir",
    );
  });
});
