import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
    const page = await openFixturePage(server);

    const topbar = await measure(page.getByTestId("forge-topbar"), "forge-topbar", page);
    const brand = await measure(page.getByTestId("forge-brand"), "forge-brand", page);
    const controls = await measure(
      page.getByTestId("forge-header-controls"),
      "forge-header-controls",
      page,
    );
    const worktree = await measure(
      page.getByTestId("forge-worktree-control"),
      "forge-worktree-control",
      page,
    );
    const project = await measure(
      page.getByTestId("forge-project-control"),
      "forge-project-control",
      page,
    );
    const nav = await measure(page.getByTestId("forge-top-nav"), "forge-top-nav", page);

    assertPositive("topbar", topbar);
    assertInside("brand", brand, topbar, page);
    assertInside("controls", controls, topbar, page);
    assertInside("navigation", nav, topbar, page);
    assertLeftToRight("worktree before project", worktree, project, page);
  });
});

async function openFixturePage(server: LiveForgeWebServer): Promise<Page> {
  const browser = await chromium.launch({ headless: true });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${serverUrl(server)}/?repo=web-client-with-a-long-layout-name`, {
    waitUntil: "networkidle",
  });
  return page;
}

async function measure(locator: Locator, name: string, page: Page): Promise<Rect> {
  await locator.waitFor({ state: "visible", timeout: 5_000 });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(await layoutFailure(page, `${name} has no bounding box`));
  }
  return box;
}

function assertPositive(name: string, rect: Rect): void {
  expect(rect.width, `${name} width should be positive`).toBeGreaterThan(0);
  expect(rect.height, `${name} height should be positive`).toBeGreaterThan(0);
}

async function assertInside(
  name: string,
  child: Rect,
  parent: Rect,
  page: Page,
): Promise<void> {
  const inside =
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width + 1 &&
    child.y + child.height <= parent.y + parent.height + 1;

  if (!inside) {
    throw new Error(await layoutFailure(page, `${name} is outside the header`, { child, parent }));
  }
}

async function assertLeftToRight(
  name: string,
  left: Rect,
  right: Rect,
  page: Page,
): Promise<void> {
  if (left.x > right.x) {
    throw new Error(await layoutFailure(page, `${name} failed`, { left, right }));
  }
}

async function layoutFailure(
  page: Page,
  message: string,
  rectangles: Record<string, Rect> = {},
): Promise<string> {
  return [
    message,
    `url: ${page.url()}`,
    `viewport: ${JSON.stringify(page.viewportSize())}`,
    `rectangles: ${JSON.stringify(rectangles, null, 2)}`,
  ].join("\n");
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
