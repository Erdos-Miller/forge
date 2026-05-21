import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  createForgeFixtureRepo,
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  plannedBody,
  type ForgeFixtureRepo,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const cliEntrypoint = path.join(repoRoot, "packages", "cli", "src", "index.ts");
const fixtureRepos: ForgeFixtureRepo[] = [];
const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];
const servers: LiveForgeWebServer[] = [];

interface LiveForgeWebServer {
  proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  port: number;
  stdout: Promise<string>;
  stderr: Promise<string>;
}

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

    const html = await fetchTextWithRetry(
      `${serverUrl(server)}/?repo=web&task=F-1001`,
      server,
    );
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("Failed to load tasks");
  });
});

async function startLiveForgeWeb(repoRoot: string): Promise<LiveForgeWebServer> {
  const port = await getAvailablePort();
  const proc = Bun.spawn(
    [
      "bun",
      cliEntrypoint,
      "web",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--dir",
      repoRoot,
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, USER: "harness" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const server = {
    proc,
    port,
    stdout: new Response(proc.stdout).text(),
    stderr: new Response(proc.stderr).text(),
  };

  await waitForServer(server);
  return server;
}

async function waitForServer(server: LiveForgeWebServer): Promise<void> {
  const deadline = Date.now() + 10_000;
  let lastError = "";

  while (Date.now() < deadline) {
    if ((await Promise.race([server.proc.exited, delay(0).then(() => null)])) !== null) {
      throw new Error(await formatServerFailure("server exited before readiness", server));
    }

    try {
      const response = await fetch(`${serverUrl(server)}/api/tasks`);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}: ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await delay(100);
  }

  throw new Error(await formatServerFailure(`server did not become ready: ${lastError}`, server));
}

async function fetchJsonWithRetry(
  url: string,
  server: LiveForgeWebServer,
): Promise<any> {
  const response = await fetch(url).catch(async (error) => {
    throw new Error(await formatServerFailure(`API request failed: ${error}`, server));
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      await formatServerFailure(`API returned ${response.status}: ${body}`, server),
    );
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(
      await formatServerFailure(`API returned invalid JSON: ${body}\n${error}`, server),
    );
  }
}

async function fetchTextWithRetry(
  url: string,
  server: LiveForgeWebServer,
): Promise<string> {
  const response = await fetch(url).catch(async (error) => {
    throw new Error(await formatServerFailure(`page request failed: ${error}`, server));
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      await formatServerFailure(`page returned ${response.status}: ${body}`, server),
    );
  }
  return body;
}

async function stopLiveForgeWeb(server: LiveForgeWebServer): Promise<void> {
  if ((await Promise.race([server.proc.exited, delay(0).then(() => null)])) === null) {
    server.proc.kill("SIGTERM");
  }
  await Promise.race([server.proc.exited, delay(3_000)]);
}

async function formatServerFailure(
  message: string,
  server: LiveForgeWebServer,
): Promise<string> {
  server.proc.kill("SIGTERM");
  const [stdout, stderr] = await Promise.all([server.stdout, server.stderr]);
  return [
    message,
    "",
    "forge web stdout:",
    tail(stdout),
    "",
    "forge web stderr:",
    tail(stderr),
  ].join("\n");
}

function serverUrl(server: LiveForgeWebServer): string {
  return `http://127.0.0.1:${server.port}`;
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("could not allocate TCP port")));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function tail(output: string): string {
  const lines = output.trimEnd().split("\n").filter(Boolean);
  return lines.slice(-40).join("\n");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
