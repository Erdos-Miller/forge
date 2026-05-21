import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  createForgeFixtureWorkspace,
  minimalForgeFixtureTasks,
  type ForgeFixtureWorkspace,
} from "../../core/test/fixture-repo";
import {
  serverUrl,
  startLiveForgeWeb,
  stopLiveForgeWeb,
  type LiveForgeWebServer,
} from "./live-server";
import {
  expectInside,
  expectLeftToRight,
  expectNoOverlap,
  expectSameRow,
  expectWrappedBelow,
  measureHeaderLayout,
} from "./layout-contract";

const browsers: Browser[] = [];
const fixtureWorkspaces: ForgeFixtureWorkspace[] = [];
const servers: LiveForgeWebServer[] = [];

afterEach(async () => {
  await Promise.all(browsers.splice(0).map((browser) => browser.close()));
  await Promise.all(servers.splice(0).map((server) => stopLiveForgeWeb(server)));
  await Promise.all(fixtureWorkspaces.splice(0).map((workspace) => workspace.cleanup()));
});

describe("Forge web layout harness", () => {
  test("measures header geometry through stable locators", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-layout-",
      roots: [
        { name: "api-service-with-a-long-layout-name", tasks: minimalForgeFixtureTasks() },
        {
          name: "web-client-with-a-long-layout-name",
          tasks: [
            {
              id: "F-1001",
              title: "Header layout fixture",
              priority: "urgent",
              project: "ui",
              scope: ["packages/web/**"],
            },
          ],
        },
      ],
    });
    fixtureWorkspaces.push(workspace);
    await writeProjectConfig(path.join(workspace.workspaceRoot, "web-client-with-a-long-layout-name"));

    const server = await startLiveForgeWeb(workspace.workspaceRoot);
    servers.push(server);
    const page = await openFixturePage(
      server,
      "/?repo=web-client-with-a-long-layout-name",
    );

    const layout = await measureHeaderLayout(page);

    expect(layout.controls).toBeDefined();
    expect(layout.worktree).toBeDefined();
    expect(layout.project).toBeDefined();
    expect(layout.topbar.width, "topbar width should be positive").toBeGreaterThan(0);
    expect(layout.topbar.height, "topbar height should be positive").toBeGreaterThan(0);
    await expectInside(page, "brand", layout.brand, layout.topbar);
    await expectInside(page, "controls", layout.controls!, layout.topbar);
    await expectInside(page, "navigation", layout.nav, layout.topbar);
    await expectSameRow(page, "desktop brand and navigation", layout.brand, layout.nav);
    await expectNoOverlap(page, "desktop brand and controls", layout.brand, layout.controls!);
    await expectNoOverlap(page, "desktop controls and navigation", layout.controls!, layout.nav);
    await expectLeftToRight(page, "Worktree before Project", layout.worktree!, layout.project!);
    await expectLeftToRight(page, "Queue before Analytics", layout.queueTab, layout.analyticsTab);
    await expectHeaderLabels(page);
  });

  test("reports conditional controls and narrow wrapping without screenshots", async () => {
    const workspace = await createForgeFixtureWorkspace({
      prefix: "forge-web-layout-minimal-",
      roots: [{ name: "solo", tasks: minimalForgeFixtureTasks() }],
    });
    fixtureWorkspaces.push(workspace);

    const server = await startLiveForgeWeb(workspace.workspaceRoot);
    servers.push(server);
    const page = await openFixturePage(server, "/", 420);

    const layout = await measureHeaderLayout(page);

    expect(layout.worktree).toBeUndefined();
    expect(layout.project).toBeUndefined();
    await expectWrappedBelow(page, "narrow navigation after brand", layout.brand, layout.nav);
    await expectLeftToRight(page, "Queue before Analytics", layout.queueTab, layout.analyticsTab);
  });
});

async function openFixturePage(
  server: LiveForgeWebServer,
  route: string,
  width = 1280,
): Promise<Page> {
  const browser = await chromium.launch({ headless: true });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width, height: 720 } });
  await page.goto(`${serverUrl(server)}${route}`, { waitUntil: "networkidle" });
  return page;
}

async function expectHeaderLabels(page: Page): Promise<void> {
  await expectText(page.getByTestId("forge-worktree-control"), "Worktree");
  await expectText(page.getByTestId("forge-project-control"), "Project");
  await expectText(page.getByTestId("forge-queue-tab"), "Queue");
  await expectText(page.getByTestId("forge-analytics-tab"), "Analytics");
}

async function expectText(locator: ReturnType<Page["getByTestId"]>, expected: string) {
  expect(await locator.textContent()).toContain(expected);
}

async function writeProjectConfig(repoRoot: string): Promise<void> {
  await fs.writeFile(
    path.join(repoRoot, ".forge", "projects.yml"),
    [
      "version: 1",
      "projects:",
      "  - id: ui",
      '    label: "User interface with a long layout label"',
      "    paths:",
      '      - "packages/web/**"',
      "",
    ].join("\n"),
  );
}
