import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createForgeFixtureRepo,
  createForgeFixtureTaskFile,
  type ForgeFixtureRepo,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

describe("archive command", () => {
  test("prints a non-mutating closed-task archive plan", async () => {
    const repo = await createForgeFixtureRepo({
      prefix: "forge-archive-cli-",
      tasks: [
        { id: "F-0001", title: "Open", status: "open" },
        {
          id: "F-0002",
          title: "Closed",
          status: "done",
          closed_at: "2026-05-15T01:00:00-05:00",
        },
      ],
    });
    fixtureRepos.push(repo);

    const result = await run(repo.repoRoot, ["archive", "--dry-run", "--json"]);
    const payload = JSON.parse(result.stdout[0]);

    expect(result.code).toBe(0);
    expect(payload.dryRun).toBe(true);
    expect(payload.tasks).toEqual([
      expect.objectContaining({
        taskId: "F-0002",
        title: "Closed",
        status: "done",
      }),
    ]);
  });

  test("rejects mutating or non-json archive usage", async () => {
    const repo = await createForgeFixtureRepo({ prefix: "forge-archive-cli-" });
    fixtureRepos.push(repo);

    const result = await run(repo.repoRoot, ["archive"]);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr[0]).error.message).toBe(
      "usage: forge archive --dry-run --json",
    );
  });

  test("doctor treats archived closed dependencies as present", async () => {
    const repo = await createForgeFixtureRepo({
      prefix: "forge-archive-cli-",
      tasks: [{ id: "F-0002", title: "Ready", depends_on: ["F-0001"] }],
    });
    fixtureRepos.push(repo);
    const archiveDir = path.join(repo.repoRoot, ".forge", "archive");
    await fs.mkdir(archiveDir, { recursive: true });
    await fs.writeFile(
      path.join(archiveDir, "F-0001-closed.md"),
      createForgeFixtureTaskFile({
        id: "F-0001",
        title: "Closed",
        status: "done",
        closed_at: "2026-05-15T01:00:00-05:00",
      }),
    );

    const result = await run(repo.repoRoot, ["doctor", "--json"]);
    const payload = JSON.parse(result.stdout[0]);

    expect(result.code).toBe(0);
    expect(payload.diagnostics.map((diagnostic: { code: string }) => diagnostic.code))
      .not.toContain("missing_dependency");
  });
});

async function run(cwd: string, args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    cwd,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { code, stdout, stderr };
}
