import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const specPath = path.join(repoRoot, ".forge", "specs", "F-0010-robot-json-contracts.md");

const expectedTopLevelKeys = {
  queue: ["ok", "version", "repoRoot", "tasks", "diagnostics"],
  next: ["ok", "version", "task", "reason"],
  show: ["ok", "version", "task"],
  blockers: ["ok", "version", "taskId", "blockers"],
  deps: ["ok", "version", "taskId", "depends_on", "dependents"],
  doctor: ["ok", "version", "summary", "diagnostics"],
  error: ["ok", "version", "error"],
} as const;

describe("robot JSON contract documentation", () => {
  test("documents parseable examples for every robot command", () => {
    const contracts = readContracts();

    expect(Object.keys(contracts).sort()).toEqual(Object.keys(expectedTopLevelKeys).sort());

    for (const [name, expectedKeys] of Object.entries(expectedTopLevelKeys)) {
      const payload = contracts[name];

      expect(Object.keys(payload)).toEqual(expectedKeys);
      expect(payload.version).toBe(1);
      expect(typeof payload.ok).toBe("boolean");
    }
  });

  test("locks representative nested response shapes", () => {
    const contracts = readContracts();

    expect(Object.keys(contracts.queue.tasks[0])).toEqual([
      "id",
      "title",
      "status",
      "priority",
      "area",
      "claimed_by",
      "scope",
      "depends_on",
      "ready",
      "rank",
      "blockers",
    ]);
    expect(Object.keys(contracts.show.task)).toEqual([
      "id",
      "title",
      "kind",
      "status",
      "priority",
      "area",
      "parent",
      "depends_on",
      "claimed_by",
      "scope",
      "created_at",
      "updated_at",
      "closed_at",
      "close_reason",
      "sourcePath",
      "body",
    ]);
    expect(Object.keys(contracts.error.error)).toEqual([
      "code",
      "message",
      "details",
    ]);
  });
});

function readContracts(): Record<string, any> {
  const spec = readFileSync(specPath, "utf8");
  const contracts: Record<string, any> = {};
  const pattern =
    /<!-- contract:([\w-]+) -->\s*```json\s*([\s\S]*?)\s*```/g;

  for (const match of spec.matchAll(pattern)) {
    contracts[match[1]] = JSON.parse(match[2]);
  }

  return contracts;
}
