import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";
import { resolveWebStartRepoRoot } from "../src";

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

describe("web workspace startup discovery", () => {
  test("uses downward discovery from the requested web start directory", async () => {
    const workspace = await makeWorkspace([
      { name: "api", tasks: minimalForgeFixtureTasks() },
      { name: "web", tasks: [{ id: "F-2001", title: "Web task" }] },
    ]);

    const resolved = await resolveWebStartRepoRoot(workspace.workspaceRoot);

    expect(resolved.repoRoot).toBe(await fs.realpath(path.join(workspace.workspaceRoot, "api")));
    expect(resolved.discoveredRoots.map((root) => root.id)).toEqual(["api", "web"]);
    expect(resolved.discoveredRoots.map((root) => root.taskCount)).toEqual([1, 1]);
  });

  test("does not climb upward for nested web start directories", async () => {
    const workspace = await makeWorkspace([
      { name: "api", tasks: minimalForgeFixtureTasks() },
    ]);

    await expect(resolveWebStartRepoRoot(workspace.roots[0].nestedDir)).rejects.toThrow(
      /no Forge roots found below/,
    );
  });
});
