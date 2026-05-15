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
}

export interface WriteWebSessionInput {
  host: string;
  port: number;
  pid: number;
  startedAt: string;
}

const sessionRelativePath = path.join(".forge", "local", "web-session.json");

export async function writeWebSession(
  repoRoot: string,
  input: WriteWebSessionInput,
): Promise<WebSession> {
  const session: WebSession = {
    repoRoot,
    host: input.host,
    port: input.port,
    baseUrl: toBaseUrl(input.host, input.port),
    pid: input.pid,
    startedAt: input.startedAt,
    source: "file",
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
    await fs.rm(sessionPath, { force: true });
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
    await fs.rm(sessionPath, { force: true });
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
  return (
    typeof candidate.repoRoot === "string" &&
    typeof candidate.baseUrl === "string" &&
    typeof candidate.pid === "number" &&
    typeof candidate.startedAt === "string"
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
