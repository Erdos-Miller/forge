import { afterEach, describe, expect, test } from "bun:test";
import { analyzeTasks, loadTasksFrom, rankReadyTasks } from "@forge/core";
import { parseWebArgs } from "../src/args";
import {
  createDemoForgeRepo,
  type DemoForgeRepo,
} from "../src/demo-repo";

const demoRepos: DemoForgeRepo[] = [];

afterEach(async () => {
  await Promise.all(demoRepos.splice(0).map((repo) => repo.cleanup()));
});

async function makeDemoRepo(): Promise<DemoForgeRepo> {
  const repo = await createDemoForgeRepo();
  demoRepos.push(repo);
  return repo;
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
