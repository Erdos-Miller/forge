import { describe, expect, test } from "bun:test";
import type { Task } from "@forge/core";
import {
  getInferredScopeOptions,
  inferScopeLabel,
  inferTaskScopeLabels,
  taskMatchesScope,
} from "../src/scopes";

describe("workspace scope inference", () => {
  test("collapses monorepo-like paths to stable prefixes", () => {
    expect(inferScopeLabel("packages/web/src/components/Queue.tsx")).toBe("packages/web");
    expect(inferScopeLabel("apps/dashboard/src/App.tsx")).toBe("apps/dashboard");
    expect(inferScopeLabel("lib/typescript/fluxchart/comparisons/**")).toBe(
      "lib/typescript/fluxchart",
    );
    expect(inferScopeLabel("product/toolhub/src/app/(bleed)/wells/**")).toBe(
      "product/toolhub",
    );
  });

  test("groups single-file and ambiguous paths under Other", () => {
    expect(inferScopeLabel("README.md")).toBe("Other");
    expect(inferScopeLabel("weird/one/off/place/**")).toBe("Other");
    expect(inferScopeLabel("*.md")).toBe("Other");
  });

  test("keeps common top-level and hidden project scopes readable", () => {
    expect(inferScopeLabel("docs/README.md")).toBe("docs");
    expect(inferScopeLabel("scripts/release.ts")).toBe("scripts");
    expect(inferScopeLabel(".forge/tasks/**")).toBe(".forge");
  });

  test("deduplicates task labels and sorts Other last", () => {
    const tasks = [
      task(["packages/web/**", "packages/web/src/App.tsx"]),
      task(["README.md"]),
      task(["lib/typescript/ui/src/components/Wells/**"]),
    ];

    expect(inferTaskScopeLabels(tasks[0])).toEqual(["packages/web"]);
    expect(getInferredScopeOptions(tasks)).toEqual([
      "lib/typescript/ui",
      "packages/web",
      "Other",
    ]);
  });

  test("matches tasks by inferred coarse scope", () => {
    const webTask = task(["packages/web/src/components/Queue.tsx"]);
    const otherTask = task(["README.md"]);

    expect(taskMatchesScope(webTask, "packages/web")).toBe(true);
    expect(taskMatchesScope(webTask, "packages/core")).toBe(false);
    expect(taskMatchesScope(otherTask, "Other")).toBe(true);
    expect(taskMatchesScope(otherTask, "all")).toBe(true);
  });

  test("matches tasks by configured scope paths", () => {
    const webTask = task(["packages/web/src/components/Queue.tsx"]);
    const readmeTask = task(["README.md"]);
    const scopeConfig = {
      source: "configured" as const,
      scopes: [
        { id: "ui", label: "UI", paths: ["packages/web/**"] },
        { id: "docs", label: "Docs", paths: ["README.md"] },
      ],
    };

    expect(taskMatchesScope(webTask, "ui", scopeConfig)).toBe(true);
    expect(taskMatchesScope(webTask, "docs", scopeConfig)).toBe(false);
    expect(taskMatchesScope(readmeTask, "docs", scopeConfig)).toBe(true);
    expect(taskMatchesScope(readmeTask, "ui", scopeConfig)).toBe(false);
  });

  test("keeps all-worktree configured scopes scoped to their root", () => {
    const webTask = {
      ...task(["packages/web/**"]),
      workspaceRootId: "web",
    };
    const apiTask = {
      ...task(["packages/web/**"]),
      workspaceRootId: "api",
    };
    const scopeConfig = {
      source: "configured" as const,
      scopes: [{ id: "web::ui", label: "web / UI", paths: ["packages/web/**"], rootId: "web" }],
    };

    expect(taskMatchesScope(webTask, "web::ui", scopeConfig)).toBe(true);
    expect(taskMatchesScope(apiTask, "web::ui", scopeConfig)).toBe(false);
    expect(taskMatchesScope(apiTask, "all", scopeConfig)).toBe(true);
  });
});

function task(scope: string[]): Task {
  return { scope } as Task;
}
