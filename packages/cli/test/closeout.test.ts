import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<{ repoRoot: string; tasksDir: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-closeout-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, "package.json"),
    JSON.stringify({ scripts: { "quality:check": "bun test" } }),
  );
  return { repoRoot, tasksDir };
}

async function runCloseout(repoRoot: string, taskId: string): Promise<any> {
  const stdout: string[] = [];
  const code = await runCli(["closeout", taskId, "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });

  expect(code).toBe(0);
  return JSON.parse(stdout[0]);
}

describe("closeout guidance", () => {
  test("reports ready-to-close evidence", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(path.join(tasksDir, "F-0001.md"), taskFile("F-0001", readyBody()));

    const payload = await runCloseout(repoRoot, "F-0001");

    expect(payload.closeout).toMatchObject({
      ready_to_close: true,
      execution_plan_present: true,
      verification_notes_present: true,
      expected_quality_command: "bun run quality:check",
      blockers: [],
      review: [],
      stop_conditions: [],
      findings: [],
    });
  });

  test("reports missing plan and missing verification notes", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(path.join(tasksDir, "F-0002.md"), taskFile("F-0002", "# Missing\n"));

    const payload = await runCloseout(repoRoot, "F-0002");
    const codes = payload.closeout.findings.map((finding: any) => finding.code);

    expect(payload.closeout.execution_plan_present).toBe(false);
    expect(payload.closeout.verification_notes_present).toBe(false);
    expect(codes).toEqual(["missing_execution_plan", "missing_verification_notes"]);
  });

  test("reports review and stop-condition context", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await fs.writeFile(
      path.join(tasksDir, "F-0003.md"),
      taskFile("F-0003", reviewBody(), {
        reviewReason: "Needs product review",
      }),
    );

    const payload = await runCloseout(repoRoot, "F-0003");
    const codes = payload.closeout.findings.map((finding: any) => finding.code);

    expect(payload.closeout.review).toEqual([
      "Needs product review",
      "Ask before changing schema.",
      "Visual review pending.",
    ]);
    expect(payload.closeout.stop_conditions).toEqual(["Stop if schema must change."]);
    expect(codes).toContain("review_needed");
    expect(codes).toContain("stop_condition_present");
  });
});

function taskFile(
  id: string,
  body: string,
  options: { reviewReason?: string; blockedReason?: string } = {},
): string {
  return [
    "---",
    `id: ${id}`,
    "title: Test",
    "kind: task",
    "status: doing",
    "priority: medium",
    'parent: ""',
    "depends_on: []",
    'claimed_by: "codex"',
    "scope:",
    "  - '**'",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    ...(options.blockedReason ? [`blocked_reason: ${JSON.stringify(options.blockedReason)}`] : []),
    ...(options.reviewReason ? [`review_reason: ${JSON.stringify(options.reviewReason)}`] : []),
    "---",
    "",
    body,
  ].join("\n");
}

function readyBody(): string {
  return [
    "# Ready",
    "",
    "## Execution Plan",
    "",
    "Stop conditions:",
    "None.",
    "",
    "Human review triggers:",
    "None.",
    "",
    "## Notes",
    "",
    "Verification:",
    "- `bun run quality:check`",
    "",
  ].join("\n");
}

function reviewBody(): string {
  return [
    "# Review",
    "",
    "## Execution Plan",
    "",
    "Stop conditions:",
    "- Stop if schema must change.",
    "",
    "Human review triggers:",
    "- Ask before changing schema.",
    "",
    "## Notes",
    "",
    "Verification:",
    "- `bun test packages/core packages/cli`",
    "Review needed: Visual review pending.",
    "",
  ].join("\n");
}
