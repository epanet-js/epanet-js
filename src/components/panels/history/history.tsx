import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { getMainBranch, getScenarios } from "src/lib/worktree";
import type { Branch, Version, Worktree } from "src/lib/worktree";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";

function getMainVersionIds(worktree: Worktree): Set<string> {
  const ids = new Set<string>();
  const mainBranch = getMainBranch(worktree);
  if (!mainBranch) return ids;
  let currentId: string | null = mainBranch.draftVersionId;
  while (currentId) {
    ids.add(currentId);
    const version = worktree.versions.get(currentId);
    if (!version) break;
    currentId = version.parentId;
  }
  return ids;
}

function getVersionChain(
  worktree: Worktree,
  branch: Branch,
  excludeIds?: Set<string>,
): Version[] {
  const versions: Version[] = [];
  let currentId = branch.draftVersionId;
  while (currentId) {
    if (excludeIds?.has(currentId)) break;
    const version = worktree.versions.get(currentId);
    if (!version) break;
    versions.push(version);
    currentId = version.parentId;
  }
  return versions.reverse();
}

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
  action,
}: {
  version: Version;
  label: string;
  action?: React.ReactNode;
}) {
  const icon = version.status === "draft" ? "✎" : "✓";
  const iconColor =
    version.status === "draft" ? "text-yellow-500" : "text-green-500";

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 font-mono text-xs text-gray-400">
        <span className={iconColor}>{icon}</span>
        <span>{version.id.slice(0, 8)}</span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <span className="text-gray-700 dark:text-gray-300 font-sans font-medium">
          {label}
        </span>
      </div>
      <div className="pl-5 mt-0.5">
        <DeltaList version={version} />
        {action}
      </div>
    </div>
  );
}

function BranchSection({
  branch,
  worktree,
  excludeIds,
  onCreateRevision,
}: {
  branch: Branch;
  worktree: Worktree;
  excludeIds?: Set<string>;
  onCreateRevision?: () => void;
}) {
  const versions = getVersionChain(worktree, branch, excludeIds);
  const isActive = worktree.activeBranchId === branch.id;

  let revisionCount = 0;

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1">
        <span className="text-xs text-gray-400">⎇</span>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {branch.name}
        </span>
        {isActive && (
          <span className="text-[10px] bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300 px-1 py-0.5 rounded">
            active
          </span>
        )}
      </div>
      <div className="pl-4">
        {versions.map((version) => {
          const isDraft = version.status === "draft";
          if (isDraft && version.deltas.length === 0) return null;
          let label: string;
          if (isDraft) {
            label = "Draft";
          } else {
            revisionCount++;
            label = version.message || `Revision ${revisionCount}`;
          }
          const showCreateRevision =
            isDraft &&
            isActive &&
            version.deltas.length > 0 &&
            onCreateRevision;

          return (
            <VersionNode
              key={version.id}
              version={version}
              label={label}
              action={
                showCreateRevision ? (
                  <button
                    onClick={onCreateRevision}
                    className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                  >
                    Create Revision
                  </button>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function ScenarioBranch({
  branch,
  worktree,
  isLast,
  excludeIds,
  onCreateRevision,
}: {
  branch: Branch;
  worktree: Worktree;
  isLast: boolean;
  excludeIds: Set<string>;
  onCreateRevision?: () => void;
}) {
  const connector = isLast ? "└── " : "├── ";

  return (
    <div className="flex">
      <span className="font-mono text-xs text-gray-300 dark:text-gray-600 shrink-0 pt-1">
        {connector}
      </span>
      <div className="flex-1 min-w-0">
        <BranchSection
          branch={branch}
          worktree={worktree}
          excludeIds={excludeIds}
          onCreateRevision={onCreateRevision}
        />
      </div>
    </div>
  );
}

export function History() {
  const worktree = useAtomValue(worktreeAtom);
  const mainBranch = getMainBranch(worktree);
  const scenarios = getScenarios(worktree);
  const { createRevisionOnActive } = useScenarioOperations();

  const mainVersionIds = getMainVersionIds(worktree);

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
        Worktree
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {mainBranch && (
          <BranchSection
            branch={mainBranch}
            worktree={worktree}
            onCreateRevision={createRevisionOnActive}
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
                excludeIds={mainVersionIds}
                onCreateRevision={
                  worktree.activeBranchId === scenario.id
                    ? createRevisionOnActive
                    : undefined
                }
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
