import { promises as fs } from "node:fs";
import path from "node:path";

export interface WebSession {
  repoRoot: string;
  host: string | null;
  port: number | null;
  baseUrl: string;
  pid: number | null;
  startedAt: string | null;
  source: "env" | "file";
  workspaceRoots?: WebSessionRoot[];
}

export interface WebSessionRoot {
  id: string;
  displayName: string;
  path: string;
}

export interface WriteWebSessionInput {
  host: string;
  port: number;
  pid: number;
  startedAt: string;
  workspaceRoots?: WebSessionRoot[];
}

const sessionRelativePath = path.join(".forge", "local", "web-session.json");

export async function writeWebSession(
  repoRoot: string,
  input: WriteWebSessionInput,
): Promise<WebSession> {
  return writeSessionFile(repoRoot, input, input.workspaceRoots);
}

export async function writeWorkspaceWebSessions(
  roots: WebSessionRoot[],
  input: WriteWebSessionInput,
): Promise<WebSession> {
  const workspaceRoots = roots.map((root) => ({
    id: root.id,
    displayName: root.displayName,
    path: root.path,
  }));
  const [primaryRoot] = workspaceRoots;
  if (!primaryRoot) {
    throw new Error("cannot write workspace web session without roots");
  }

  const sessions = await Promise.all(
    workspaceRoots.map((root) => writeSessionFile(root.path, input, workspaceRoots)),
  );
  return sessions.find((session) => session.repoRoot === primaryRoot.path) ?? sessions[0];
}

async function writeSessionFile(
  repoRoot: string,
  input: WriteWebSessionInput,
  workspaceRoots?: WebSessionRoot[],
): Promise<WebSession> {
  const session: WebSession = {
    repoRoot,
    host: input.host,
    port: input.port,
    baseUrl: toBaseUrl(input.host, input.port),
    pid: input.pid,
    startedAt: input.startedAt,
    source: "file",
    ...(workspaceRoots && workspaceRoots.length > 0 ? { workspaceRoots } : {}),
  };
  const sessionPath = getWebSessionPath(repoRoot);
  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`);
  return session;
}

export async function discoverWebSession(
  repoRoot: string,
  env: Record<string, string | undefined>,
): Promise<WebSession | null> {
  const overrideUrl = env.FORGE_WEB_URL?.trim();
  if (overrideUrl) {
    return {
      repoRoot,
      host: null,
      port: null,
      baseUrl: normalizeBaseUrl(overrideUrl),
      pid: null,
      startedAt: null,
      source: "env",
    };
  }

  const sessionPath = getWebSessionPath(repoRoot);
  const session = await readSessionFile(sessionPath);
  if (!session) {
    return null;
  }
  if (!session.pid || !pidIsAlive(session.pid)) {
    await removeSessionFiles(repoRoot, session);
    return null;
  }
  return { ...session, source: "file" };
}

export async function removeWebSession(
  repoRoot: string,
  pid: number,
): Promise<void> {
  const sessionPath = getWebSessionPath(repoRoot);
  const session = await readSessionFile(sessionPath);
  if (session?.pid === pid) {
    await removeSessionFiles(repoRoot, session);
  }
}

export function getWebSessionPath(repoRoot: string): string {
  return path.join(repoRoot, sessionRelativePath);
}

function toBaseUrl(host: string, port: number): string {
  return `http://${host}:${port}/`;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function removeSessionFiles(repoRoot: string, session: WebSession): Promise<void> {
  const roots = new Set([repoRoot, ...(session.workspaceRoots ?? []).map((root) => root.path)]);
  await Promise.all(
    Array.from(roots).map((root) => fs.rm(getWebSessionPath(root), { force: true })),
  );
}

async function readSessionFile(sessionPath: string): Promise<WebSession | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    if (!isSessionFile(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isSessionFile(value: unknown): value is WebSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<WebSession>;
  const workspaceRootsValid =
    candidate.workspaceRoots === undefined ||
    (Array.isArray(candidate.workspaceRoots) &&
      candidate.workspaceRoots.every(isSessionRoot));
  return (
    typeof candidate.repoRoot === "string" &&
    typeof candidate.baseUrl === "string" &&
    typeof candidate.pid === "number" &&
    typeof candidate.startedAt === "string" &&
    workspaceRootsValid
  );
}

function isSessionRoot(value: unknown): value is WebSessionRoot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<WebSessionRoot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.path === "string"
  );
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string }).code === "EPERM";
  }
}
