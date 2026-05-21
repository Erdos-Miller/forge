import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs, type Dirent } from "node:fs";
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
    const ignoredDirs = [
      ".cache",
      ".hidden-project",
      ".mypy_cache",
      ".next",
      ".parcel-cache",
      ".pytest_cache",
      ".ruff_cache",
      ".svelte-kit",
      ".turbo",
      ".venv",
      ".vite",
      "build",
      "coverage",
      "dist",
      "generated",
      "node_modules",
      "out",
      "target",
      "tmp",
      "vendor",
    ];
    await Promise.all(
      ignoredDirs.map((dirName, index) =>
        workspace.writeIgnoredRoot([dirName, "ignored"], [
          { id: `F-${9000 + index}`, title: `Ignored ${dirName} root` },
        ]),
      ),
    );

    const roots = await discoverForgeRootsDownward(workspace.workspaceRoot);

    expect(roots.map((root) => root.id)).toEqual(["app"]);
  });

  test("applies configured workspace discovery ignores", async () => {
    const workspace = await makeWorkspace([
      { name: "app", tasks: minimalForgeFixtureTasks() },
    ]);
    await workspace.writeIgnoredRoot(["sandbox-output", "ignored"], [
      { id: "F-9901", title: "Ignored configured root" },
    ]);
    await fs.writeFile(
      path.join(workspace.workspaceRoot, "forge.workspace.yml"),
      [
        "version: 1",
        "discovery:",
        "  ignore:",
        '    - "sandbox-output/**"',
        "",
      ].join("\n"),
    );

    const roots = await discoverForgeRootsDownward(workspace.workspaceRoot);

    expect(roots.map((root) => root.id)).toEqual(["app"]);
  });

  test("uses bounded concurrent traversal while preserving stable output", async () => {
    const workspace = await makeWorkspace(
      Array.from({ length: 8 }, (_value, index) => ({
        name: `root-${index}`,
        tasks: minimalForgeFixtureTasks(),
      })),
    );
    const readdir = createDelayedReaddir(10);

    const roots = await discoverForgeRootsDownward(workspace.workspaceRoot, {
      concurrency: 3,
      readdir,
    });

    expect(readdir.maxActive).toBeLessThanOrEqual(3);
    expect(readdir.maxActive).toBeGreaterThan(1);
    expect(roots.map((root) => root.id)).toEqual([
      "root-0",
      "root-1",
      "root-2",
      "root-3",
      "root-4",
      "root-5",
      "root-6",
      "root-7",
    ]);
  });

  test("runs faster than serial traversal on a delayed fixture tree", async () => {
    const workspace = await makeWorkspace(
      Array.from({ length: 8 }, (_value, index) => ({
        name: `root-${index}`,
        tasks: minimalForgeFixtureTasks(),
      })),
    );

    const serialStart = performance.now();
    await discoverForgeRootsDownward(workspace.workspaceRoot, {
      concurrency: 1,
      readdir: createDelayedReaddir(12),
    });
    const serialDuration = performance.now() - serialStart;

    const parallelStart = performance.now();
    await discoverForgeRootsDownward(workspace.workspaceRoot, {
      concurrency: 8,
      readdir: createDelayedReaddir(12),
    });
    const parallelDuration = performance.now() - parallelStart;

    expect(parallelDuration).toBeLessThan(serialDuration * 0.75);
  });
});

function createDelayedReaddir(delayMs: number) {
  let active = 0;
  const readdir = async (dir: string): Promise<Dirent[]> => {
    active += 1;
    readdir.maxActive = Math.max(readdir.maxActive, active);
    await delay(delayMs);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    active -= 1;
    return entries;
  };
  readdir.maxActive = 0;
  return readdir;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
