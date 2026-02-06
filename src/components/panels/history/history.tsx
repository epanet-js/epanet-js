import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { getMainBranch, getScenarios } from "src/lib/worktree";
import type { Branch, Version, Worktree } from "src/lib/worktree";

function DeltaList({ version }: { version: Version }) {
  if (version.deltas.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {version.deltas.map((delta, i) => (
        <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
          {delta.note || "untitled"}
        </div>
      ))}
    </div>
  );
}

function VersionNode({
  version,
  label,
  isActive,
}: {
  version: Version;
  label: string;
  isActive: boolean;
}) {
  const icon = version.status === "draft" ? "✎" : "✓";
  const iconColor =
    version.status === "draft" ? "text-yellow-500" : "text-green-500";

  return (
    <div
      className={`py-1.5 ${isActive ? "bg-purple-50 dark:bg-purple-900/20 rounded" : ""}`}
    >
      <div className="flex items-center gap-1.5 font-mono text-xs text-gray-400">
        <span className={iconColor}>{icon}</span>
        <span>{version.id.slice(0, 8)}</span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <span
          className={
            isActive
              ? "text-purple-600 dark:text-purple-400 font-sans font-medium"
              : "text-gray-700 dark:text-gray-300 font-sans font-medium"
          }
        >
          {label}
        </span>
        {isActive && (
          <span className="text-[10px] bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300 px-1 py-0.5 rounded">
            active
          </span>
        )}
      </div>
      <div className="pl-5 mt-0.5">
        <DeltaList version={version} />
      </div>
    </div>
  );
}

function ScenarioBranch({
  branch,
  worktree,
  isLast,
}: {
  branch: Branch;
  worktree: Worktree;
  isLast: boolean;
}) {
  const draftVersion = branch.draftVersionId
    ? worktree.versions.get(branch.draftVersionId)
    : null;
  const isActive = worktree.activeBranchId === branch.id;
  const connector = isLast ? "└── " : "├── ";

  return (
    <div className="flex">
      <span className="font-mono text-xs text-gray-300 dark:text-gray-600 shrink-0 pt-1.5">
        {connector}
      </span>
      <div className="flex-1 min-w-0">
        {draftVersion && (
          <VersionNode
            version={draftVersion}
            label={branch.name}
            isActive={isActive}
          />
        )}
      </div>
    </div>
  );
}

export function History() {
  const worktree = useAtomValue(worktreeAtom);
  const mainBranch = getMainBranch(worktree);
  const scenarios = getScenarios(worktree);

  const mainDraft = mainBranch?.draftVersionId
    ? worktree.versions.get(mainBranch.draftVersionId)
    : null;
  const isMainActive = mainBranch
    ? worktree.activeBranchId === mainBranch.id
    : false;

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
        Worktree
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {mainBranch && mainDraft && (
          <VersionNode
            version={mainDraft}
            label="Main"
            isActive={isMainActive}
          />
        )}
        {scenarios.length > 0 && (
          <div className="pl-3">
            {scenarios.map((scenario, i) => (
              <ScenarioBranch
                key={scenario.id}
                branch={scenario}
                worktree={worktree}
                isLast={i === scenarios.length - 1}
              />
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div>Branches: {worktree.branches.size}</div>
        <div>Versions: {worktree.versions.size}</div>
      </div>
    </div>
  );
}
