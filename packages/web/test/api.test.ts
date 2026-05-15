import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getTaskGraphPayload } from "../src/api";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

function taskFile(options: {
  id: string;
  title: string;
  status?: string;
  area?: string;
  depends_on?: string[];
}): string {
  const area = options.area ? [`area: ${options.area}`] : [];
  const dependsOn = options.depends_on?.length
    ? "\n" + options.depends_on.map((id) => `  - ${id}`).join("\n")
    : " []";

  return [
    "---",
    `id: ${options.id}`,
    `title: ${options.title}`,
    "kind: task",
    `status: ${options.status ?? "open"}`,
    "priority: medium",
    ...area,
    'parent: ""',
    `depends_on:${dependsOn}`,
    'claimed_by: ""',
    "scope:",
    "  - packages/**",
    "created_at: 2026-05-14T00:00:00-05:00",
    "updated_at: 2026-05-14T00:00:00-05:00",
    "---",
    "",
    `# ${options.title}`,
    "",
  ].join("\n");
}

async function makeRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-web-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  const nestedDir = path.join(repoRoot, "apps", "web", "src");
  await fs.mkdir(tasksDir, { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });
  await fs.writeFile(
    path.join(tasksDir, "F-0001-done.md"),
    taskFile({ id: "F-0001", title: "Done", status: "done", area: "core" }),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-0002-ready.md"),
    taskFile({ id: "F-0002", title: "Ready", depends_on: ["F-0001"] }),
  );
  await fs.writeFile(
    path.join(tasksDir, "F-0003-blocked.md"),
    taskFile({ id: "F-0003", title: "Blocked", depends_on: ["F-0002"] }),
  );
  return { repoRoot, nestedDir };
}

describe("getTaskGraphPayload", () => {
  test("returns tasks and graph analysis", async () => {
    const { repoRoot } = await makeRepo();

    const payload = await getTaskGraphPayload(repoRoot);

    expect(payload.tasks.map((task) => task.id)).toEqual([
      "F-0001",
      "F-0002",
      "F-0003",
    ]);
    expect(payload.readyTaskIds).toEqual(["F-0002"]);
    expect(payload.recommendedTaskIds).toEqual(["F-0002"]);
    expect(payload.availabilityByTaskId).toEqual({
      "F-0001": "closed",
      "F-0002": "ready",
      "F-0003": "blocked",
    });
    expect(payload.blockersByTaskId["F-0003"]).toEqual([
      "dependency F-0002 is open",
    ]);
    expect(payload.diagnostics.missingDependencies).toEqual([]);
  });

  test("works from nested directories via root discovery", async () => {
    const { repoRoot, nestedDir } = await makeRepo();

    const payload = await getTaskGraphPayload(nestedDir);

    expect(payload.repoRoot).toBe(repoRoot);
    expect(payload.readyTaskIds).toEqual(["F-0002"]);
    expect(payload.recommendedTaskIds).toEqual(["F-0002"]);
  });
});
