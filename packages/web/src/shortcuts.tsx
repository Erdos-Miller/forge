import type { ScopeFilterPayload } from "./api";
import type { WorkspaceGraph } from "./workspace";

export function ShortcutHelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <section
      aria-label="Keyboard shortcuts"
      className="shortcutOverlay"
      role="dialog"
    >
      <div className="shortcutPanel">
        <header>
          <h2>Keyboard shortcuts</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <dl>
          <div>
            <dt>[ / ]</dt>
            <dd>Previous or next Worktree</dd>
          </div>
          <div>
            <dt>{"{ / }"}</dt>
            <dd>Previous or next Project</dd>
          </div>
          <div>
            <dt>Arrow keys</dt>
            <dd>Move through the visible queue</dd>
          </div>
          <div>
            <dt>?</dt>
            <dd>Show this reference</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function getWorkspaceShortcutSelection(input: {
  key: string;
  worktreeIds: string[];
  selectedWorktreeId: string;
  projectIds: string[];
  selectedProjectId: string;
}): { handled: boolean; kind: "worktree" | "project" | null; id: string | null } {
  if (input.key === "[" || input.key === "]") {
    const handled = input.worktreeIds.length > 1;
    return {
      handled,
      kind: "worktree",
      id: handled
        ? getCycledOption(input.worktreeIds, input.selectedWorktreeId, input.key === "]" ? 1 : -1)
        : null,
    };
  }
  if (input.key === "{" || input.key === "}") {
    const handled = input.projectIds.length > 1;
    return {
      handled,
      kind: "project",
      id: handled
        ? getCycledOption(input.projectIds, input.selectedProjectId, input.key === "}" ? 1 : -1)
        : null,
    };
  }
  return { handled: false, kind: null, id: null };
}

export function getCycledOption(
  options: string[],
  selectedOption: string,
  direction: -1 | 1,
): string | null {
  if (options.length === 0) {
    return null;
  }
  const selectedIndex = options.includes(selectedOption)
    ? options.indexOf(selectedOption)
    : 0;
  return options[(selectedIndex + direction + options.length) % options.length];
}

export function getCyclableWorktreeIds(workspaceGraphs: WorkspaceGraph[]) {
  return workspaceGraphs.length > 1 ? ["all", ...workspaceGraphs.map((root) => root.id)] : [];
}

export function getCyclableProjectIds(scopeOptions: ScopeFilterPayload[]) {
  return scopeOptions.length > 0 ? ["all", ...scopeOptions.map((scope) => scope.id)] : [];
}

export function shouldIgnoreQueueShortcutTarget(target: EventTarget | null) {
  return shouldIgnoreShortcutTarget(target, { ignoreSelect: true });
}

export function shouldIgnoreWorkspaceShortcutTarget(target: EventTarget | null) {
  return shouldIgnoreShortcutTarget(target, { ignoreSelect: false });
}

function shouldIgnoreShortcutTarget(
  target: EventTarget | null,
  options: { ignoreSelect: boolean },
) {
  if (!target || !("tagName" in target)) {
    return false;
  }

  const tagName = String((target as { tagName?: unknown }).tagName).toLowerCase();
  if (["input", "textarea", "button", "a"].includes(tagName)) {
    return true;
  }
  if (options.ignoreSelect && tagName === "select") {
    return true;
  }
  if (
    Boolean((target as { isContentEditable?: unknown }).isContentEditable) ||
    (target as { getAttribute?: (name: string) => string | null }).getAttribute?.(
      "contenteditable",
    ) === "true"
  ) {
    return true;
  }

  if (typeof Element !== "undefined" && target instanceof Element) {
    return Boolean(
      target.closest("button, a, [role='button'], [contenteditable='true']"),
    );
  }

  return false;
}
