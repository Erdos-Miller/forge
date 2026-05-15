import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  analyzeTasks,
  getReadyTasks,
  getTaskBlockers,
  loadTasks,
  rankReadyTasks,
  type Task,
} from "../src";

const repoRoot = path.resolve(import.meta.dir, "../../..");

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    kind: overrides.kind ?? "task",
    status: overrides.status ?? "open",
    priority: overrides.priority ?? "medium",
    parent: overrides.parent ?? "",
    depends_on: overrides.depends_on ?? [],
    claimed_by: overrides.claimed_by ?? "",
    scope: overrides.scope ?? ["packages/**"],
    created_at: overrides.created_at ?? "2026-05-14T00:00:00-05:00",
    updated_at: overrides.updated_at ?? "2026-05-14T00:00:00-05:00",
    body: overrides.body ?? "",
    sourcePath: overrides.sourcePath ?? `${overrides.id}.md`,
  };
}

describe("analyzeTasks", () => {
  test("marks an open unclaimed task with no dependencies as ready", () => {
    const tasks = [task({ id: "F-0001" })];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual(["F-0001"]);
    expect(getReadyTasks(tasks).map((readyTask) => readyTask.id)).toEqual(["F-0001"]);
  });

  test("treats done and canceled dependencies as satisfied", () => {
    const tasks = [
      task({ id: "F-0001", status: "done" }),
      task({ id: "F-0002", status: "canceled" }),
      task({ id: "F-0003", depends_on: ["F-0001", "F-0002"] }),
    ];

    expect(analyzeTasks(tasks).readyTaskIds).toEqual(["F-0003"]);
  });

  test("blocks tasks with unfinished dependencies", () => {
    const tasks = [
      task({ id: "F-0001", status: "doing" }),
      task({ id: "F-0002", depends_on: ["F-0001"] }),
    ];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(getTaskBlockers(tasks[1], analysis)).toContain("dependency F-0001 is doing");
  });

  test("blocks claimed tasks", () => {
    const tasks = [task({ id: "F-0001", claimed_by: "codex" })];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(getTaskBlockers(tasks[0], analysis)).toEqual(["claimed by codex"]);
  });

  test("blocks tasks with non-open status", () => {
    const tasks = [task({ id: "F-0001", status: "blocked" })];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(getTaskBlockers(tasks[0], analysis)).toEqual(["status is blocked"]);
  });

  test("reports missing dependency ids", () => {
    const tasks = [task({ id: "F-0002", depends_on: ["F-9999"] })];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(analysis.missingDependencies).toEqual([
      { taskId: "F-0002", dependencyId: "F-9999" },
    ]);
    expect(getTaskBlockers(tasks[0], analysis)).toContain(
      "missing dependency F-9999",
    );
  });

  test("reports duplicate task ids", () => {
    const tasks = [
      task({ id: "F-0001", sourcePath: "one.md" }),
      task({ id: "F-0001", sourcePath: "two.md" }),
    ];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(analysis.duplicateTaskIds).toEqual([
      { taskId: "F-0001", sourcePaths: ["one.md", "two.md"] },
    ]);
    expect(getTaskBlockers(tasks[0], analysis)).toContain("duplicate task id F-0001");
  });

  test("reports a simple dependency cycle", () => {
    const tasks = [task({ id: "F-0001", depends_on: ["F-0001"] })];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(analysis.dependencyCycles).toEqual([{ taskIds: ["F-0001", "F-0001"] }]);
    expect(getTaskBlockers(tasks[0], analysis)).toContain(
      "dependency cycle: F-0001 -> F-0001",
    );
  });

  test("reports a multi-node dependency cycle", () => {
    const tasks = [
      task({ id: "F-0001", depends_on: ["F-0002"] }),
      task({ id: "F-0002", depends_on: ["F-0003"] }),
      task({ id: "F-0003", depends_on: ["F-0001"] }),
    ];
    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toEqual([]);
    expect(analysis.dependencyCycles).toEqual([
      { taskIds: ["F-0001", "F-0002", "F-0003", "F-0001"] },
    ]);
    expect(getTaskBlockers(tasks[1], analysis)).toContain(
      "dependency cycle: F-0001 -> F-0002 -> F-0003 -> F-0001",
    );
  });

  test("finds F-0003 ready in the bootstrap task set after F-0002 is done", async () => {
    const tasks = (await loadTasks(repoRoot)).map((loadedTask) =>
      loadedTask.id === "F-0003"
        ? { ...loadedTask, status: "open" as const, claimed_by: "" }
        : loadedTask,
    );

    const analysis = analyzeTasks(tasks);

    expect(analysis.readyTaskIds).toContain("F-0003");
    expect(getTaskBlockers(tasks.find((loadedTask) => loadedTask.id === "F-0003")!, analysis)).toEqual(
      [],
    );
  });
});

describe("rankReadyTasks", () => {
  test("orders ready tasks by priority, downstream unblock count, then id", () => {
    const tasks = [
      task({ id: "F-0004", priority: "medium" }),
      task({ id: "F-0002", priority: "high" }),
      task({ id: "F-0003", priority: "high" }),
      task({ id: "F-0001", priority: "urgent" }),
      task({ id: "F-0005", status: "blocked", priority: "urgent" }),
      task({ id: "F-0006", status: "blocked", depends_on: ["F-0003"] }),
      task({ id: "F-0007", status: "blocked", depends_on: ["F-0003"] }),
      task({ id: "F-0008", status: "blocked", depends_on: ["F-0002"] }),
    ];

    expect(rankReadyTasks(tasks).map((readyTask) => readyTask.id)).toEqual([
      "F-0001",
      "F-0003",
      "F-0002",
      "F-0004",
    ]);
  });
});
