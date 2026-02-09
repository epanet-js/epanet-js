import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { worktreeAtom } from "src/state/scenarios";
import { getMainBranch, getBranch } from "src/lib/worktree";
import type { Branch, Version, Worktree } from "src/lib/worktree";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { AddScenarioIcon, CommitIcon, MainModelIcon, PinIcon } from "src/icons";

type BranchTree = {
  children: Map<string, string[]>;
  ownVersionIds: Map<string, Set<string>>;
  lockedRevisionIds: Set<string>;
  forkChildren: Map<string, string[]>;
  rootBranchIds: string[];
};

function computeBranchTree(worktree: Worktree): BranchTree {
  const versionOwner = new Map<string, string>();
  const children = new Map<string, string[]>();
  const ownVersionIds = new Map<string, Set<string>>();
  const lockedRevisionIds = new Set<string>();
  const forkChildren = new Map<string, string[]>();
  const rootBranchIds: string[] = [];

  const mainBranch = getMainBranch(worktree);
  if (!mainBranch)
    return {
      children,
      ownVersionIds,
      lockedRevisionIds,
      forkChildren,
      rootBranchIds,
    };

  const mainOwn = new Set<string>();
  let id: string | null = mainBranch.draftVersionId;
  while (id) {
    versionOwner.set(id, mainBranch.id);
    mainOwn.add(id);
    const v = worktree.versions.get(id);
    if (!v) break;
    id = v.parentId;
  }
  ownVersionIds.set(mainBranch.id, mainOwn);
  children.set(mainBranch.id, []);

  let remaining = [...worktree.branches.values()].filter(
    (b) => b.id !== "main",
  );
  let changed = true;
  while (changed && remaining.length > 0) {
    changed = false;
    const nextRemaining: Branch[] = [];

    for (const branch of remaining) {
      const own = new Set<string>();
      let currentId: string | null = branch.draftVersionId;
      let foundParent: string | undefined;

      while (currentId) {
        const owner = versionOwner.get(currentId);
        if (owner) {
          foundParent = owner;
          break;
        }
        own.add(currentId);
        const v = worktree.versions.get(currentId);
        if (!v) break;
        currentId = v.parentId;
      }

      if (foundParent && currentId) {
        lockedRevisionIds.add(currentId);
        if (!forkChildren.has(currentId)) forkChildren.set(currentId, []);
        forkChildren.get(currentId)!.push(branch.id);
        for (const vid of own) {
          versionOwner.set(vid, branch.id);
        }
        ownVersionIds.set(branch.id, own);
        children.get(foundParent)!.push(branch.id);
        children.set(branch.id, []);
        changed = true;
      } else if (!foundParent && currentId === null) {
        for (const vid of own) {
          versionOwner.set(vid, branch.id);
        }
        ownVersionIds.set(branch.id, own);
        children.set(branch.id, []);
        rootBranchIds.push(branch.id);
        changed = true;
      } else {
        nextRemaining.push(branch);
      }
    }

    remaining = nextRemaining;
  }

  for (const branch of remaining) {
    ownVersionIds.set(branch.id, new Set());
    children.get(mainBranch.id)!.push(branch.id);
    children.set(branch.id, []);
  }

  return {
    children,
    ownVersionIds,
    lockedRevisionIds,
    forkChildren,
    rootBranchIds,
  };
}

function getVersionChain(
  worktree: Worktree,
  branch: Branch,
  ownIds: Set<string>,
): Version[] {
  const versions: Version[] = [];
  let currentId = branch.draftVersionId;
  while (currentId) {
    if (!ownIds.has(currentId)) break;
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
  isLocked,
  onBranch,
  onCommit,
  onPromote,
}: {
  version: Version;
  isLocked?: boolean;
  onBranch?: () => void;
  onCommit?: () => void;
  onPromote?: () => void;
}) {
  const isDraft = version.status === "draft";
  const statusIcon = isDraft ? "✎" : "✓";
  const iconColor = isDraft ? "text-yellow-500" : "text-green-500";
  const label = isDraft ? "Draft" : version.message || version.id.slice(0, 8);

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 text-xs">
        <span className={`font-mono ${iconColor}`}>{statusIcon}</span>
        <span
          className={
            isDraft
              ? "text-gray-400 italic"
              : "text-gray-700 dark:text-gray-300"
          }
        >
          {label}
        </span>
        {isLocked && (
          <span className="text-amber-500" title="Locked — has child branches">
            <MainModelIcon size="sm" />
          </span>
        )}
        {onCommit && (
          <button
            onClick={onCommit}
            className="text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors"
            title="Save changes"
          >
            <CommitIcon size="sm" />
          </button>
        )}
        {onBranch && (
          <button
            onClick={onBranch}
            className="text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
            title="Create scenario from this revision"
          >
            <AddScenarioIcon size="sm" />
          </button>
        )}
        {onPromote && (
          <button
            onClick={onPromote}
            className="text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            title="Pin — promote to independent branch"
          >
            <PinIcon size="sm" />
          </button>
        )}
      </div>
      <div className="pl-5 mt-0.5">
        <DeltaList version={version} />
      </div>
    </div>
  );
}

function BranchNode({
  branchId,
  worktree,
  tree,
  isLast,
  depth,
  onCreateRevision,
  onBranchFromVersion,
  onPromoteVersion,
}: {
  branchId: string;
  worktree: Worktree;
  tree: BranchTree;
  isLast?: boolean;
  depth: number;
  onCreateRevision: () => void;
  onBranchFromVersion: (versionId: string) => void;
  onPromoteVersion: (versionId: string) => void;
}) {
  const branch = getBranch(worktree, branchId);
  if (!branch) return null;

  const isMain = branchId === "main";
  const ownIds = tree.ownVersionIds.get(branchId) ?? new Set<string>();
  const versions = getVersionChain(worktree, branch, ownIds);
  const revisions = versions.filter((v) => v.status === "revision");
  const draft = versions.find(
    (v) => v.status === "draft" && v.deltas.length > 0,
  );
  const isActive = worktree.activeBranchId === branchId;

  const content = (
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
      {revisions.map((version) => {
        const forkedChildren = tree.forkChildren.get(version.id);
        return (
          <div key={version.id}>
            <div className="pl-4">
              <VersionNode
                version={version}
                isLocked={tree.lockedRevisionIds.has(version.id)}
                onBranch={
                  isMain ? () => onBranchFromVersion(version.id) : undefined
                }
                onPromote={() => onPromoteVersion(version.id)}
              />
            </div>
            {forkedChildren && forkedChildren.length > 0 && (
              <div className="pl-3">
                {forkedChildren.map((childId, i) => (
                  <BranchNode
                    key={childId}
                    branchId={childId}
                    worktree={worktree}
                    tree={tree}
                    isLast={i === forkedChildren.length - 1}
                    depth={depth + 1}
                    onCreateRevision={onCreateRevision}
                    onBranchFromVersion={onBranchFromVersion}
                    onPromoteVersion={onPromoteVersion}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {draft && (
        <div className="pl-4">
          <VersionNode
            version={draft}
            onCommit={isActive ? onCreateRevision : undefined}
          />
        </div>
      )}
    </div>
  );

  if (depth === 0) return content;

  const connector = isLast ? "└── " : "├── ";
  return (
    <div className="flex">
      <span className="font-mono text-xs text-gray-300 dark:text-gray-600 shrink-0 pt-1">
        {connector}
      </span>
      <div className="flex-1 min-w-0">{content}</div>
    </div>
  );
}

export function History() {
  const worktree = useAtomValue(worktreeAtom);
  const {
    createRevisionOnActive,
    createScenarioFromVersion,
    promoteVersionToNewBranch,
  } = useScenarioOperations();
  const setDialog = useSetAtom(dialogAtom);

  const openSaveRevisionDialog = useCallback(() => {
    setDialog({
      type: "saveRevision",
      onConfirm: createRevisionOnActive,
    });
  }, [setDialog, createRevisionOnActive]);

  const openPromoteDialog = useCallback(
    (versionId: string) => {
      setDialog({
        type: "promoteVersion",
        versionId,
        onConfirm: promoteVersionToNewBranch,
      });
    },
    [setDialog, promoteVersionToNewBranch],
  );

  const tree = useMemo(() => computeBranchTree(worktree), [worktree]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
        History
      </div>
      <div className="px-3 py-2 space-y-0.5">
        <BranchNode
          branchId="main"
          worktree={worktree}
          tree={tree}
          depth={0}
          onCreateRevision={openSaveRevisionDialog}
          onBranchFromVersion={createScenarioFromVersion}
          onPromoteVersion={openPromoteDialog}
        />
        {tree.rootBranchIds.map((rootId) => (
          <BranchNode
            key={rootId}
            branchId={rootId}
            worktree={worktree}
            tree={tree}
            depth={0}
            onCreateRevision={openSaveRevisionDialog}
            onBranchFromVersion={createScenarioFromVersion}
            onPromoteVersion={openPromoteDialog}
          />
        ))}
      </div>
      <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div>Branches: {worktree.branches.size}</div>
        <div>Versions: {worktree.versions.size}</div>
      </div>
    </div>
  );
}
