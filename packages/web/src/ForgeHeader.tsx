import type { ScopeFilterPayload } from "./api";
import type { WorkspaceGraph } from "./workspace";

export type ForgeView = "queue" | "analytics";

interface ForgeHeaderProps {
  activeTab: ForgeView;
  projectFilter: string;
  resolvedRepoId: string;
  scopeOptions: ScopeFilterPayload[];
  workspaceGraphs: WorkspaceGraph[];
  onProjectChange: (projectId: string) => void;
  onRepoChange: (repoId: string) => void;
  onTabChange: (tab: ForgeView) => void;
}

export function ForgeHeader({
  activeTab,
  projectFilter,
  resolvedRepoId,
  scopeOptions,
  workspaceGraphs,
  onProjectChange,
  onRepoChange,
  onTabChange,
}: ForgeHeaderProps) {
  return (
    <header className="topbar" data-testid="forge-topbar">
      <div className="brandBlock" data-testid="forge-brand">
        <h1>Forge</h1>
      </div>
      <div className="headerControls" data-testid="forge-header-controls">
        {workspaceGraphs.length > 1 ? (
          <label className="headerControl" data-testid="forge-worktree-control">
            <span>Worktree</span>
            <select value={resolvedRepoId} onChange={(event) => onRepoChange(event.target.value)}>
              <option value="all">All repos</option>
              {workspaceGraphs.map((root) => (
                <option key={root.id} value={root.id}>
                  {root.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {scopeOptions.length > 0 ? (
          <label className="headerControl" data-testid="forge-project-control">
            <span>Project</span>
            <select
              value={projectFilter}
              onChange={(event) => onProjectChange(event.target.value)}
            >
              <option value="all">All projects</option>
              {scopeOptions.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <nav className="topNav" aria-label="Forge views" data-testid="forge-top-nav">
        <button
          className={activeTab === "queue" ? "active" : ""}
          data-testid="forge-queue-tab"
          type="button"
          onClick={() => onTabChange("queue")}
        >
          Queue
        </button>
        <button
          className={activeTab === "analytics" ? "active" : ""}
          data-testid="forge-analytics-tab"
          type="button"
          onClick={() => onTabChange("analytics")}
        >
          Analytics
        </button>
      </nav>
    </header>
  );
}
