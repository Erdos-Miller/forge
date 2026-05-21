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

describe("doctor decision-record behavior", () => {
  test("does not warn for broad contract-surface tasks without decision records", async () => {
    const repo = await makeRepo([
      {
        id: "F-0001",
        title: "Broad contract task",
        scope: ["packages/cli/**", "packages/web/**", "packages/core/**"],
      },
    ]);

    const payload = await runDoctor(repo.repoRoot);

    expect(findDecisionDiagnostics(payload)).toEqual([]);
  });

  test("does not require decision outcomes for resolved review notes", async () => {
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

    expect(findDecisionDiagnostics(payload)).toEqual([]);
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

function findDecisionDiagnostics(payload: any) {
  return payload.diagnostics.filter((candidate: any) =>
    candidate.code.startsWith("decision_capture"),
  );
}
