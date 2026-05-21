# Forge Web Layout Harness

Forge web layout work should start from executable browser contracts when the
change can affect header, navigation, responsive wrapping, or control geometry.

Use `bun run harness:web:layout` for those changes. The harness starts an
isolated Forge web server with deterministic fixture data, then uses Playwright
locators and bounding boxes to measure production markup.

Layout contracts should:

- Use stable `data-testid` telemetry in normal production markup.
- Assert geometry with rectangles, ordering, overlap, and wrapping checks.
- Print useful URL, viewport, and rectangle details on failure.
- Avoid screenshot snapshots, visual golden files, and manual browser judgment.
- Add the failing contract before changing CSS when fixing a layout regression.

After the focused layout harness passes, run `bun run harness:web` for the wider
web surface.
