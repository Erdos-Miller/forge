import { afterEach, describe, expect, test } from "bun:test";
import {
  createForgeFixtureRepo,
  type ForgeFixtureRepo,
} from "../../core/test/fixture-repo";
import { runCli } from "../src";

const fixtureRepos: ForgeFixtureRepo[] = [];

afterEach(async () => {
  await Promise.all(fixtureRepos.splice(0).map((repo) => repo.cleanup()));
});

describe("decision capture doctor diagnostics", () => {
  test("warns for broad active contract-surface tasks without decision capture", async () => {
    const repo = await makeRepo([
      {
        id: "F-0001",
        title: "Broad contract task",
        scope: ["packages/cli/**", "packages/web/**", "packages/core/**"],
      },
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "decision_capture_missing");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      taskId: "F-0001",
    });
    expect(diagnostic.sourcePath).toContain("F-0001");
    expect(diagnostic.repairHint).toContain(".forge/decisions/");
  });

  test("does not warn for narrow tasks", async () => {
    const repo = await makeRepo([
      { id: "F-0001", title: "Narrow task", scope: ["packages/web/**"] },
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(findDiagnostics(payload, "decision_capture_missing")).toEqual([]);
  });

  test("suppresses closed historical tasks", async () => {
    const repo = await makeRepo([
      {
        id: "F-0001",
        title: "Closed broad task",
        status: "done",
        scope: ["packages/cli/**", "packages/web/**", "packages/core/**"],
      },
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(findDiagnostics(payload, "decision_capture_missing")).toEqual([]);
  });

  test("suppresses broad tasks that link a durable decision record", async () => {
    const repo = await makeRepo([
      {
        id: "F-0001",
        title: "Documented broad task",
        scope: ["packages/cli/**", "packages/web/**", "packages/core/**"],
        body: [
          fixtureBody("Documented broad task"),
          "Decision record: .forge/decisions/0001-workspace-terminology.md",
          "",
        ].join("\n"),
      },
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(findDiagnostics(payload, "decision_capture_missing")).toEqual([]);
  });

  test("warns for resolved review or stop-condition notes without decision outcome", async () => {
    const repo = await makeRepo([
      {
        id: "F-0001",
        title: "Resolved review task",
        body: fixtureBody("Resolved review task", [
          "## Execution Plan",
          "",
          "Stop conditions:",
          "- Stop if public semantics change.",
          "",
          "Human review triggers:",
          "- Ask before changing CLI behavior.",
          "",
          "## Notes",
          "",
          "Review resolved: CLI wording can change.",
          "",
        ]),
      },
    ]);

    const payload = await runDoctor(repo.repoRoot);
    const diagnostic = findDiagnostic(payload, "decision_capture_missing_resolution");

    expect(diagnostic).toMatchObject({
      severity: "warning",
      taskId: "F-0001",
    });
    expect(diagnostic.repairHint).toContain("## Notes");
  });
});

async function makeRepo(tasks: Parameters<typeof createForgeFixtureRepo>[0]["tasks"]) {
  const repo = await createForgeFixtureRepo({
    prefix: "forge-decision-doctor-",
    tasks,
  });
  fixtureRepos.push(repo);
  return repo;
}

function fixtureBody(title: string, extraSections: string[] = []): string {
  return [
    `# ${title}`,
    "",
    "## Why",
    "",
    "The task has enough context.",
    "",
    "## What success looks like",
    "",
    "The expected end state is clear.",
    "",
    "## Acceptance Criteria",
    "",
    "- The task has observable criteria.",
    "",
    ...extraSections,
    ...(extraSections.length ? [] : ["## Verification", "", "- bun test", "", "## Notes", "", ""]),
  ].join("\n");
}

async function runDoctor(repoRoot: string): Promise<any> {
  const stdout: string[] = [];
  const code = await runCli(["doctor", "--json"], {
    cwd: repoRoot,
    stdout: (message) => stdout.push(message),
    stderr: () => {},
  });
  expect(code).toBe(0);
  expect(stdout).toHaveLength(1);
  return JSON.parse(stdout[0]);
}

function findDiagnostic(payload: any, code: string) {
  const diagnostic = findDiagnostics(payload, code)[0];
  expect(diagnostic).toBeDefined();
  return diagnostic;
}

function findDiagnostics(payload: any, code: string) {
  return payload.diagnostics.filter((candidate: any) => candidate.code === code);
}
