import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadTasksFrom } from "../src";
import {
  blockedForgeFixtureTasks,
  claimedForgeFixtureTasks,
  createForgeFixtureRepo,
  doneForgeFixtureTasks,
  legacyForgeFixtureTasks,
  minimalForgeFixtureTasks,
  type ForgeFixtureRepo,
} from "./fixture-repo";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

async function makeRepo(tasks = minimalForgeFixtureTasks()): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({ tasks });
  fixtureRepos.push(repo);
  return repo;
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
