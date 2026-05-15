import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addTaskDependency,
  parseTaskFile,
  removeTaskDependency,
  type TaskStatus,
} from "../src";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true })));
});

async function makeRepo(): Promise<{ repoRoot: string; tasksDir: string }> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-core-deps-test-"));
  tempDirs.push(repoRoot);
  const tasksDir = path.join(repoRoot, ".forge", "tasks");
  await fs.mkdir(tasksDir, { recursive: true });
  return { repoRoot, tasksDir };
}

async function writeTask(
  tasksDir: string,
  id: string,
  overrides: {
    title?: string;
    dependsOn?: string[];
    status?: TaskStatus;
    extraFrontmatter?: string[];
    body?: string;
  } = {},
): Promise<string> {
  const title = overrides.title ?? id;
  const sourcePath = path.join(tasksDir, `${id.toLowerCase()}-${slug(title)}.md`);
  await fs.writeFile(
    sourcePath,
    [
      "---",
      `id: ${id}`,
      `title: ${title}`,
      "kind: task",
      `status: ${overrides.status ?? "open"}`,
      "priority: medium",
      'parent: ""',
      ...(overrides.dependsOn?.length
        ? ["depends_on:", ...overrides.dependsOn.map((dependencyId) => `  - ${dependencyId}`)]
        : ["depends_on: []"]),
      'claimed_by: ""',
      ...(overrides.extraFrontmatter ?? []),
      "scope:",
      "  - packages/**",
      "created_at: 2026-05-14T00:00:00-05:00",
      "updated_at: 2026-05-14T00:00:00-05:00",
      "---",
      "",
      `# ${title}`,
      "",
      overrides.body ?? "Body stays readable.",
      "",
    ].join("\n"),
  );
  return sourcePath;
}

describe("dependency edits", () => {
  test("adds a dependency and preserves body and unknown frontmatter", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    const taskPath = await writeTask(tasksDir, "F-0002", {
      extraFrontmatter: ["custom_field: keep me"],
      body: "## Custom\n\nDo not lose this.",
    });
    await writeTask(tasksDir, "F-0001");

    const result = await addTaskDependency(
      repoRoot,
      "F-0002",
      "F-0001",
      new Date("2026-05-15T12:00:00Z"),
    );
    const contents = await fs.readFile(taskPath, "utf8");
    const parsed = parseTaskFile(taskPath, contents);

    expect(result.changed).toBe(true);
    expect(result.reason).toBe("added");
    expect(parsed.task.depends_on).toEqual(["F-0001"]);
    expect(parsed.task.updated_at).toBe("2026-05-15T12:00:00.000Z");
    expect(contents).toContain("custom_field: keep me");
    expect(contents).toContain("## Custom\n\nDo not lose this.");
  });

  test("treats duplicate add as a no-op", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, "F-0002", { dependsOn: ["F-0001"] });
    await writeTask(tasksDir, "F-0001");

    const result = await addTaskDependency(repoRoot, "F-0002", "F-0001");

    expect(result.changed).toBe(false);
    expect(result.reason).toBe("already_present");
    expect(result.task.depends_on).toEqual(["F-0001"]);
  });

  test("removes a dependency and treats absent remove as a no-op", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    const taskPath = await writeTask(tasksDir, "F-0002", {
      dependsOn: ["F-0001", "F-0003"],
    });
    await writeTask(tasksDir, "F-0001");
    await writeTask(tasksDir, "F-0003");

    const removed = await removeTaskDependency(
      repoRoot,
      "F-0002",
      "F-0001",
      new Date("2026-05-15T13:00:00Z"),
    );
    const absent = await removeTaskDependency(repoRoot, "F-0002", "F-0001");
    const parsed = parseTaskFile(taskPath, await fs.readFile(taskPath, "utf8"));

    expect(removed.changed).toBe(true);
    expect(removed.reason).toBe("removed");
    expect(absent.changed).toBe(false);
    expect(absent.reason).toBe("absent");
    expect(parsed.task.depends_on).toEqual(["F-0003"]);
  });

  test("rejects missing task ids and dependency ids", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, "F-0001");

    await expect(addTaskDependency(repoRoot, "F-4040", "F-0001")).rejects.toThrow(
      "task F-4040 not found",
    );
    await expect(addTaskDependency(repoRoot, "F-0001", "F-4040")).rejects.toThrow(
      "task F-4040 not found",
    );
  });

  test("rejects edits that would create a dependency cycle", async () => {
    const { repoRoot, tasksDir } = await makeRepo();
    await writeTask(tasksDir, "F-0001", { dependsOn: ["F-0002"] });
    await writeTask(tasksDir, "F-0002");

    await expect(addTaskDependency(repoRoot, "F-0002", "F-0001")).rejects.toThrow(
      "dependency edit would create a cycle",
    );
  });
});

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
