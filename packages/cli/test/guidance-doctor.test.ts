import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<{ repoRoot: string; forgeDir: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-guidance-doctor-"));
  tempDirs.push(repoRoot);
  const forgeDir = path.join(repoRoot, ".forge");
  const tasksDir = path.join(forgeDir, "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(path.join(tasksDir, "F-0001.md"), taskFile());
  return { repoRoot, forgeDir };
}

async function runDoctor(repoRoot: string): Promise<{
  code: number;
  payload: any;
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });

  expect(stderr).toEqual([]);
  return { code, payload: JSON.parse(stdout[0]) };
}

describe("guidance doctor checks", () => {
  test("reports invalid guidance config", async () => {
    const { repoRoot, forgeDir } = await makeRepo();
    await fs.writeFile(path.join(forgeDir, "guidance.yml"), "version: two\nroutes: []\n");

    const { code, payload } = await runDoctor(repoRoot);

    expect(code).toBe(4);
    expect(payload.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_guidance_config",
        severity: "error",
      }),
    );
  });

  test("reports missing and unreadable includes", async () => {
    const { repoRoot, forgeDir } = await makeRepo();
    const guidanceDir = path.join(forgeDir, "guidance");
    await fs.mkdir(guidanceDir, { recursive: true });
    await fs.writeFile(
      path.join(forgeDir, "guidance.yml"),
      [
        "version: 1",
        "routes:",
        "  - include: guidance/missing.md",
        "  - include: guidance",
        "",
      ].join("\n"),
    );

    const { code, payload } = await runDoctor(repoRoot);
    const codes = payload.diagnostics.map((diagnostic: any) => diagnostic.code);

    expect(code).toBe(4);
    expect(codes).toContain("missing_guidance_include");
    expect(codes).toContain("unreadable_guidance_include");
  });

  test("warns on duplicate include routes and unignored local guidance", async () => {
    const { repoRoot, forgeDir } = await makeRepo();
    const guidanceDir = path.join(forgeDir, "guidance");
    await fs.mkdir(path.join(forgeDir, "local"), { recursive: true });
    await fs.mkdir(guidanceDir, { recursive: true });
    await fs.writeFile(path.join(forgeDir, "local", "user.md"), "# Local\n");
    await fs.writeFile(path.join(guidanceDir, "core.md"), "# Core\n");
    await fs.writeFile(
      path.join(forgeDir, "guidance.yml"),
      [
        "version: 1",
        "routes:",
        "  - include: guidance/core.md",
        "    when:",
        "      area:",
        "        - core",
        "  - include: guidance/core.md",
        "    when:",
        "      area:",
        "        - core",
        "",
      ].join("\n"),
    );

    const { code, payload } = await runDoctor(repoRoot);

    expect(code).toBe(0);
    expect(payload.summary).toEqual({ errors: 0, warnings: 2 });
    expect(payload.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicate_guidance_include",
        severity: "warning",
      }),
    );
    expect(payload.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "local_guidance_not_ignored",
        severity: "warning",
      }),
    );
  });
});

function taskFile(): string {
  return [
    "---",
    "id: F-0001",
    "title: Test",
    "kind: task",
    "status: open",
    "priority: medium",
    'parent: ""',
    "depends_on: []",
    'claimed_by: ""',
    "scope:",
    "  - '**'",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    "---",
    "",
    "# Test",
    "",
  ].join("\n");
}
