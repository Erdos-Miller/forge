import { describe, expect, test } from "bun:test";
import { parseScopeConfig } from "../src/scope-config";

describe("project config compatibility", () => {
  test("parses preferred projects config with legacy scopes alias", () => {
    const config = parseScopeConfig(
      [
        "version: 1",
        "projects:",
        "  - id: web",
        '    label: "Web"',
        '    description: "Browser UI"',
        "    paths:",
        '      - "packages/web/**"',
        "",
      ].join("\n"),
    );

    expect(config.projects).toEqual([
      {
        id: "web",
        label: "Web",
        description: "Browser UI",
        paths: ["packages/web/**"],
      },
    ]);
    expect(config.scopes).toBe(config.projects);
  });

  test("parses legacy scopes config as projects", () => {
    const config = parseScopeConfig(
      [
        "version: 1",
        "scopes:",
        "  - id: cli",
        '    label: "CLI"',
        "    paths:",
        '      - "packages/cli/**"',
        "",
      ].join("\n"),
    );

    expect(config.projects).toEqual([
      { id: "cli", label: "CLI", paths: ["packages/cli/**"] },
    ]);
    expect(config.scopes).toBe(config.projects);
  });
});
