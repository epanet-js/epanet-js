import type { Worktree, VersionId, Branch } from "./types";

function computeVersionOwnership(worktree: Worktree): Map<string, string> {
  const versionOwner = new Map<string, string>();

  const mainBranch = worktree.branches.get("main");
  if (mainBranch) {
    let id: string | null = mainBranch.draftVersionId;
    while (id) {
      versionOwner.set(id, "main");
      const v = worktree.versions.get(id);
      if (!v) break;
      id = v.parentId;
    }
  }

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
      let foundParent = false;

      while (currentId) {
        if (versionOwner.has(currentId)) {
          foundParent = true;
          break;
        }
        own.add(currentId);
        const v = worktree.versions.get(currentId);
        if (!v) break;
        currentId = v.parentId;
      }

      if (foundParent || currentId === null) {
        for (const vid of own) {
          versionOwner.set(vid, branch.id);
        }
        changed = true;
      } else {
        nextRemaining.push(branch);
      }
    }

    remaining = nextRemaining;
  }

  return versionOwner;
}

export const rebaseChildBranches = (
  worktree: Worktree,
  committingBranchId: string,
  oldParentId: VersionId,
  newParentId: VersionId,
): { worktree: Worktree; rebasedBranchIds: string[] } => {
  const versionOwner = computeVersionOwnership(worktree);

  if (versionOwner.get(oldParentId) !== committingBranchId) {
    return { worktree, rebasedBranchIds: [] };
  }

  const updatedVersions = new Map(worktree.versions);
  const updatedBranches = new Map(worktree.branches);
  const rebasedBranchSet = new Set<string>();

  for (const [versionId, version] of updatedVersions) {
    if (
      version.parentId === oldParentId &&
      versionId !== newParentId &&
      versionOwner.get(versionId) !== committingBranchId
    ) {
      updatedVersions.set(versionId, { ...version, parentId: newParentId });
      const owner = versionOwner.get(versionId);
      if (owner) rebasedBranchSet.add(owner);
    }
  }

  if (rebasedBranchSet.size === 0) {
    return { worktree, rebasedBranchIds: [] };
  }

  const rebasedBranchIds: string[] = [];

  for (const [branchId, branch] of updatedBranches) {
    if (!rebasedBranchSet.has(branchId)) continue;

    rebasedBranchIds.push(branchId);

    if (branch.headRevisionId === oldParentId) {
      updatedBranches.set(branchId, {
        ...branch,
        headRevisionId: newParentId,
      });
    }
  }

  return {
    worktree: {
      ...worktree,
      versions: updatedVersions,
      branches: updatedBranches,
    },
    rebasedBranchIds,
  };
};
