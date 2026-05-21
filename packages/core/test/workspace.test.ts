import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  scaleForgeFixtureTasks,
  type ForgeFixtureWorkspace,
} from "./fixture-repo";
import { discoverForgeRootsDownward } from "../src";

const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];

afterEach(async () => {
  await Promise.all(fixtureWorkspaces.splice(0).map((workspace) => workspace.cleanup()));
});

async function makeWorkspace(
  roots: Parameters<typeof createForgeFixtureWorkspace>[0]["roots"] = [],
): Promise<ForgeFixtureWorkspace> {
  const workspace = await createForgeFixtureWorkspace({ roots });
  fixtureWorkspaces.push(workspace);
  return workspace;
}

describe("discoverForgeRootsDownward", () => {
  test("returns no roots for an empty parent workspace", async () => {
    const workspace = await makeWorkspace();

    await expect(discoverForgeRootsDownward(workspace.workspaceRoot)).resolves.toEqual([]);
  });

  test("returns stable metadata for one and many Forge roots", async () => {
    const workspace = await makeWorkspace([
      { name: "api", tasks: minimalForgeFixtureTasks() },
      { name: "web", tasks: scaleForgeFixtureTasks(3) },
    ]);

    await expect(discoverForgeRootsDownward(workspace.workspaceRoot)).resolves.toEqual([
      {
        id: "api",
        displayName: "api",
        path: await fs.realpath(path.join(workspace.workspaceRoot, "api")),
        taskCount: 1,
      },
      {
        id: "web",
        displayName: "web",
        path: await fs.realpath(path.join(workspace.workspaceRoot, "web")),
        taskCount: 3,
      },
    ]);
  });

  test("does not climb upward from nested directories", async () => {
    const workspace = await makeWorkspace([
      { name: "api", tasks: minimalForgeFixtureTasks() },
    ]);

    await expect(discoverForgeRootsDownward(workspace.roots[0].nestedDir)).resolves.toEqual([]);
  });

  test("ignores expensive or local-only directories", async () => {
    const workspace = await makeWorkspace([
      { name: "app", tasks: minimalForgeFixtureTasks() },
    ]);
    await workspace.writeIgnoredRoot(["node_modules", "ignored"], [
      { id: "F-9001", title: "Ignored dependency root" },
    ]);
    await workspace.writeIgnoredRoot(["dist", "ignored"], [
      { id: "F-9002", title: "Ignored build root" },
    ]);

    const roots = await discoverForgeRootsDownward(workspace.workspaceRoot);

    expect(roots.map((root) => root.id)).toEqual(["app"]);
  });
});
