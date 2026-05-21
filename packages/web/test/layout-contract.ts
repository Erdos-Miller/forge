import type { Locator, Page } from "playwright";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeaderLayout {
  analyticsTab: Rect;
  brand: Rect;
  controls?: Rect;
  nav: Rect;
  project?: Rect;
  queueTab: Rect;
  topbar: Rect;
  worktree?: Rect;
}

const tolerance = 1;

export async function measureHeaderLayout(page: Page): Promise<HeaderLayout> {
  return {
    analyticsTab: await measure(page.getByTestId("forge-analytics-tab"), "analytics tab", page),
    brand: await measure(page.getByTestId("forge-brand"), "brand", page),
    controls: await measureOptional(
      page.getByTestId("forge-header-controls"),
      "header controls",
      page,
    ),
    nav: await measure(page.getByTestId("forge-top-nav"), "top navigation", page),
    project: await measureOptional(page.getByTestId("forge-project-control"), "Project control", page),
    queueTab: await measure(page.getByTestId("forge-queue-tab"), "Queue tab", page),
    topbar: await measure(page.getByTestId("forge-topbar"), "topbar", page),
    worktree: await measureOptional(
      page.getByTestId("forge-worktree-control"),
      "Worktree control",
      page,
    ),
  };
}

export async function expectInside(
  page: Page,
  label: string,
  child: Rect,
  parent: Rect,
): Promise<void> {
  const inside =
    child.x >= parent.x - tolerance &&
    child.y >= parent.y - tolerance &&
    child.x + child.width <= parent.x + parent.width + tolerance &&
    child.y + child.height <= parent.y + parent.height + tolerance;

  if (!inside) {
    throw new Error(await layoutFailure(page, `${label} is outside expected bounds`, { child, parent }));
  }
}

export async function expectLeftToRight(
  page: Page,
  label: string,
  left: Rect,
  right: Rect,
): Promise<void> {
  if (left.x > right.x + tolerance) {
    throw new Error(await layoutFailure(page, `${label} left-to-right order failed`, { left, right }));
  }
}

export async function expectNoOverlap(
  page: Page,
  label: string,
  first: Rect,
  second: Rect,
): Promise<void> {
  if (rectsOverlap(first, second)) {
    throw new Error(await layoutFailure(page, `${label} overlap failed`, { first, second }));
  }
}

export async function expectSameRow(
  page: Page,
  label: string,
  first: Rect,
  second: Rect,
): Promise<void> {
  if (Math.abs(first.y - second.y) > Math.max(first.height, second.height) / 2) {
    throw new Error(await layoutFailure(page, `${label} same-row placement failed`, { first, second }));
  }
}

export async function expectWrappedBelow(
  page: Page,
  label: string,
  upper: Rect,
  lower: Rect,
): Promise<void> {
  if (lower.y + tolerance < upper.y) {
    throw new Error(await layoutFailure(page, `${label} narrow wrapping failed`, { upper, lower }));
  }
}

export async function expectAdjacentLane(
  page: Page,
  label: string,
  left: Rect,
  right: Rect,
  maxGap: number,
): Promise<void> {
  const gap = right.x - (left.x + left.width);
  if (gap < -tolerance || gap > maxGap) {
    throw new Error(
      await layoutFailure(page, `${label} adjacent-lane placement failed`, {
        left,
        right,
        gap: { x: gap, y: 0, width: maxGap, height: 0 },
      }),
    );
  }
}

async function measure(locator: Locator, name: string, page: Page): Promise<Rect> {
  await locator.waitFor({ state: "visible", timeout: 5_000 });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(await layoutFailure(page, `${name} has no bounding box`));
  }
  return box;
}

async function measureOptional(
  locator: Locator,
  name: string,
  page: Page,
): Promise<Rect | undefined> {
  if ((await locator.count()) === 0) {
    return undefined;
  }
  if (!(await locator.isVisible())) {
    return undefined;
  }
  return measure(locator, name, page);
}

function rectsOverlap(first: Rect, second: Rect): boolean {
  return !(
    first.x + first.width <= second.x + tolerance ||
    second.x + second.width <= first.x + tolerance ||
    first.y + first.height <= second.y + tolerance ||
    second.y + second.height <= first.y + tolerance
  );
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
