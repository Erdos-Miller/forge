import net from "node:net";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const cliEntrypoint = path.join(repoRoot, "packages", "cli", "src", "index.ts");

export interface LiveForgeWebServer {
  proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  port: number;
  stdout: Promise<string>;
  stderr: Promise<string>;
}

export async function startLiveForgeWeb(repoRoot: string): Promise<LiveForgeWebServer> {
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

export async function fetchJsonWithRetry(
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

export async function fetchTextWithRetry(
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

export async function stopLiveForgeWeb(server: LiveForgeWebServer): Promise<void> {
  if ((await Promise.race([server.proc.exited, delay(0).then(() => null)])) === null) {
    server.proc.kill("SIGTERM");
  }
  await Promise.race([server.proc.exited, delay(3_000)]);
}

export async function formatServerFailure(
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

export function serverUrl(server: LiveForgeWebServer): string {
  return `http://127.0.0.1:${server.port}`;
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
