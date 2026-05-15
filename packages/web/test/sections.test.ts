import { describe, expect, test } from "bun:test";
import { organizeTaskMarkdown } from "../src/sections";

describe("organizeTaskMarkdown", () => {
  test("maps canonical sections into the display order", () => {
    const sections = organizeTaskMarkdown(
      [
        "# Example",
        "",
        "## Verification",
        "",
        "- bun test",
        "",
        "## Why",
        "",
        "This matters.",
        "",
        "## What success looks like",
        "",
        "The task is done.",
        "",
        "## Acceptance Criteria",
        "",
        "- It works.",
        "",
      ].join("\n"),
    );

    expect(sections.why?.body).toBe("This matters.");
    expect(sections.success?.body).toBe("The task is done.");
    expect(sections.acceptance?.body).toBe("- It works.");
    expect(sections.verification?.body).toBe("- bun test");
  });

  test("keeps unknown sections renderable", () => {
    const sections = organizeTaskMarkdown(
      [
        "# Example",
        "",
        "## Why",
        "",
        "This matters.",
        "",
        "## Extra Review Notes",
        "",
        "Keep this visible.",
        "",
      ].join("\n"),
    );

    expect(sections.additional.map((section) => section.title)).toEqual([
      "Extra Review Notes",
    ]);
  });
});
