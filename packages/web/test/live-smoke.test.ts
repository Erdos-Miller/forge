import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import {
  createForgeFixtureRepo,
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  plannedBody,
  type ForgeFixtureRepo,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";
import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
  serverUrl,
  startLiveForgeWeb,
  stopLiveForgeWeb,
  type LiveForgeWebServer,
} from "./live-server";

const fixtureRepos: ForgeFixtureRepo[] = [];
const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];
const servers: LiveForgeWebServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => stopLiveForgeWeb(server)));
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
  await Promise.all(fixtureWorkspaces.splice(0).map((workspace) => workspace.cleanup()));
});

describe("live Forge web smoke harness", () => {
  test("serves task graph JSON and the web entrypoint from a fixture repo", async () => {
    const repo = await createForgeFixtureRepo({
      prefix: "forge-web-smoke-",
      tasks: [
        {
          id: "F-0001",
          title: "Closed base",
          status: "done",
          priority: "high",
        },
        {
          id: "F-0002",
          title: "Ready live smoke task",
          priority: "urgent",
          depends_on: ["F-0001"],
        },
        {
          id: "F-0003",
          title: "Blocked live smoke follow-up",
          depends_on: ["F-0002"],
        },
        {
          id: "F-0004",
          title: "Claimed live smoke task",
          claimed_by: "codex",
          body: plannedBody("Claimed live smoke task"),
        },
      ],
    });
    fixtureRepos.push(repo);

    const server = await startLiveForgeWeb(repo.repoRoot);
    servers.push(server);

    const api = await fetchJsonWithRetry(`${serverUrl(server)}/api/tasks`, server);
    const repoRoot = await fs.realpath(repo.repoRoot);

    expect(api).toMatchObject({
      repoRoot,
      readyTaskIds: ["F-0002"],
      recommendedTaskIds: ["F-0002"],
      diagnostics: {
        missingDependencies: [],
        dependencyCycles: [],
        duplicateTaskIds: [],
      },
    });
    expect(api.tasks.map((task: { id: string }) => task.id)).toEqual([
      "F-0001",
      "F-0002",
      "F-0003",
      "F-0004",
    ]);
    expect(api.availabilityByTaskId).toEqual({
      "F-0001": "closed",
      "F-0002": "ready",
      "F-0003": "blocked",
      "F-0004": "claimed",
    });
    expect(api.blockersByTaskId["F-0003"]).toEqual([
      "dependency F-0002 is open",
    ]);
    expect(api.workspace.roots).toEqual([
      expect.objectContaining({
        id: ".",
        path: repoRoot,
        status: "ok",
        taskCount: 4,
        summary: expect.objectContaining({
          totalTasks: 4,
          readyTaskIds: ["F-0002"],
        }),
      }),
    ]);
    expect(api.workspace.diagnostics.loadTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "workspace.discover_roots_cache",
          durationMs: 0,
          rootCount: 1,
        }),
      ]),
    );

    const html = await fetchTextWithRetry(serverUrl(server), server);
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("Failed to load tasks");
  });

  test("serves a multi-root workspace payload from one web session", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-workspace-smoke-",
      roots: [
        { name: "api", tasks: minimalForgeFixtureTasks() },
        {
          name: "web",
          tasks: [
            {
              id: "F-1001",
              title: "Web workspace smoke task",
              priority: "urgent",
              area: "web",
            },
          ],
        },
      ],
    });
    fixtureWorkspaces.push(workspace);

    const server = await startLiveForgeWeb(workspace.workspaceRoot);
    servers.push(server);

    const api = await fetchJsonWithRetry(`${serverUrl(server)}/api/tasks`, server);

    expect(api.workspace.roots.map((root: { id: string }) => root.id)).toEqual([
      "api",
      "web",
    ]);
    expect(api.workspace.roots.map((root: { status: string }) => root.status)).toEqual([
      "ok",
      "ok",
    ]);
    expect(api.workspace.roots[0].graph.readyTaskIds).toEqual(["F-0001"]);
    expect(api.workspace.roots[1].graph.readyTaskIds).toEqual(["F-1001"]);
    expect(api.workspace.diagnostics.loadTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "workspace.discover_roots_cache",
          durationMs: 0,
          rootCount: 2,
        }),
      ]),
    );

    const html = await fetchTextWithRetry(
      `${serverUrl(server)}/?repo=web&task=F-1001`,
      server,
    );
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("Failed to load tasks");
  });
});
