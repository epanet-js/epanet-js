import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { getMainBranch, getScenarios, isMainBranch } from "src/lib/worktree";
import type { Branch, Worktree } from "src/lib/worktree";

function VersionInfo({
  branch,
  worktree,
}: {
  branch: Branch;
  worktree: Worktree;
}) {
  const headVersion = worktree.versions.get(branch.headRevisionId);
  const draftVersion = branch.draftVersionId
    ? worktree.versions.get(branch.draftVersionId)
    : null;

  return (
    <div className="text-xs text-gray-400 font-mono space-y-0.5">
      {headVersion && (
        <div className="flex items-center gap-1">
          <span className="text-green-500">✓</span>
          <span>rev: {branch.headRevisionId.slice(0, 8)}</span>
          <span className="text-gray-500">
            ({headVersion.deltas.length} deltas)
          </span>
        </div>
      )}
      {draftVersion && (
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">✎</span>
          <span>draft: {branch.draftVersionId?.slice(0, 8)}</span>
          <span className="text-gray-500">
            ({draftVersion.deltas.length} deltas)
          </span>
        </div>
      )}
    </div>
  );
}

function BranchItem({
  branch,
  worktree,
  isActive,
}: {
  branch: Branch;
  worktree: Worktree;
  isActive: boolean;
}) {
  const isMain = isMainBranch(branch.id);

  return (
    <div
      className={`px-3 py-2 border-b border-gray-100 dark:border-gray-700 ${isActive ? "bg-purple-50 dark:bg-purple-900/20" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${isActive ? "text-purple-600 dark:text-purple-400" : "text-gray-800 dark:text-gray-200"}`}
        >
          {isMain ? "Main" : branch.name}
        </span>
        {isActive && (
          <span className="text-xs bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded">
            active
          </span>
        )}
      </div>
      <div className="mt-1 pl-2">
        <VersionInfo branch={branch} worktree={worktree} />
      </div>
    </div>
  );
}

export function History() {
  const worktree = useAtomValue(worktreeAtom);
  const mainBranch = getMainBranch(worktree);
  const scenarios = getScenarios(worktree);

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
        Worktree
      </div>
      {mainBranch && (
        <BranchItem
          branch={mainBranch}
          worktree={worktree}
          isActive={worktree.activeBranchId === mainBranch.id}
        />
      )}
      {scenarios.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
            Scenarios
          </div>
          {scenarios.map((scenario) => (
            <BranchItem
              key={scenario.id}
              branch={scenario}
              worktree={worktree}
              isActive={worktree.activeBranchId === scenario.id}
            />
          ))}
        </>
      )}
      <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div>Branches: {worktree.branches.size}</div>
        <div>Versions: {worktree.versions.size}</div>
      </div>
    </div>
  );
}
