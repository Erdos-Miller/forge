import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import {
  createForgeFixtureRepo,
  type ForgeFixtureRepo,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";
import {
  discoverWebSession,
  getWebSessionPath,
  writeWebSession,
} from "../src/web-session";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

async function makeRepo(): Promise<ForgeFixtureRepo> {
  const repo = await createForgeFixtureRepo({ prefix: "forge-web-session-" });
  fixtureRepos.push(repo);
  return repo;
}

async function runStatus(
  cwd: string,
  env: Record<string, string | undefined> = {},
): Promise<Record<string, any>> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(["web", "status", "--json"], {
    cwd,
    env,
    now: new Date("2026-05-15T12:00:00Z"),
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });

  expect({ code, stderr }).toEqual({ code: 0, stderr: [] });
  expect(stdout).toHaveLength(1);
  return JSON.parse(stdout[0]);
}

describe("web session discovery", () => {
  test("writes and discovers a worktree-local web session", async () => {
    const repo = await makeRepo();

    const written = await writeWebSession(repo.repoRoot, {
      host: "127.0.0.1",
      port: 5199,
      pid: process.pid,
      startedAt: "2026-05-15T12:00:00.000Z",
    });
    const raw = JSON.parse(await fs.readFile(getWebSessionPath(repo.repoRoot), "utf8"));
    const discovered = await discoverWebSession(repo.repoRoot, {});

    expect(raw).toMatchObject({
      repoRoot: repo.repoRoot,
      host: "127.0.0.1",
      port: 5199,
      baseUrl: "http://127.0.0.1:5199/",
      pid: process.pid,
      startedAt: "2026-05-15T12:00:00.000Z",
    });
    expect(discovered).toEqual(written);
  });

  test("removes stale session files when the recorded pid is gone", async () => {
    const repo = await makeRepo();
    await writeWebSession(repo.repoRoot, {
      host: "127.0.0.1",
      port: 5199,
      pid: 999_999_999,
      startedAt: "2026-05-15T12:00:00.000Z",
    });

    await expect(discoverWebSession(repo.repoRoot, {})).resolves.toBeNull();
    await expect(fs.stat(getWebSessionPath(repo.repoRoot))).rejects.toThrow();
  });

  test("uses FORGE_WEB_URL as an explicit session override", async () => {
    const repo = await makeRepo();

    await expect(
      discoverWebSession(repo.repoRoot, { FORGE_WEB_URL: "http://example.test:7777" }),
    ).resolves.toMatchObject({
      repoRoot: repo.repoRoot,
      baseUrl: "http://example.test:7777/",
      source: "env",
      pid: null,
    });
  });

  test("web status reports env, file, stale, and missing sessions", async () => {
    const repo = await makeRepo();

    expect(await runStatus(repo.nestedDir)).toMatchObject({
      repoRoot: repo.repoRoot,
      session: null,
    });
    expect(await runStatus(repo.nestedDir, { FORGE_WEB_URL: "http://override.test" }))
      .toMatchObject({
        session: {
          baseUrl: "http://override.test/",
          source: "env",
        },
      });

    await writeWebSession(repo.repoRoot, {
      host: "127.0.0.1",
      port: 5199,
      pid: process.pid,
      startedAt: "2026-05-15T12:00:00.000Z",
    });
    expect(await runStatus(repo.nestedDir)).toMatchObject({
      session: {
        baseUrl: "http://127.0.0.1:5199/",
        source: "file",
      },
    });

    await writeWebSession(repo.repoRoot, {
      host: "127.0.0.1",
      port: 5199,
      pid: 999_999_999,
      startedAt: "2026-05-15T12:00:00.000Z",
    });
    expect(await runStatus(repo.nestedDir)).toMatchObject({ session: null });
  });
});
