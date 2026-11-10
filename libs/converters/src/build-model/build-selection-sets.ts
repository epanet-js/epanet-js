import type { AssetId } from "@epanet-js/hydraulic-model";
import type { IssueCollector } from "../issues";
import type { SelectionSetData, SelectionSetGroupData } from "../network-data";

export type BuiltSelectionSetGroup = {
  ref: string;
  label: string;
  parentRef?: string;
};

export type BuiltSelectionSet = {
  label: string;
  groupRef?: string;
  assetIds: AssetId[];
};

export type BuiltSelectionSets = {
  selectionSetGroups: BuiltSelectionSetGroup[];
  selectionSets: BuiltSelectionSet[];
};

export type SelectionSetLookup = {
  nodeIdByRef: (ref: string) => AssetId | undefined;
  linkIdByRef: (ref: string) => AssetId | undefined;
};

export const buildSelectionSets = (
  groupRecords: SelectionSetGroupData[],
  records: SelectionSetData[],
  lookup: SelectionSetLookup,
  issues: IssueCollector,
): BuiltSelectionSets => {
  const selectionSetGroups = buildGroups(groupRecords, issues);
  const groupRefs = new Set(selectionSetGroups.map((group) => group.ref));
  const selectionSets: BuiltSelectionSet[] = [];

  for (const record of records) {
    const assetIds = new Set<AssetId>();
    for (const ref of record.nodeRefs) {
      const id = lookup.nodeIdByRef(ref);
      if (id !== undefined) assetIds.add(id);
    }
    for (const ref of record.linkRefs) {
      const id = lookup.linkIdByRef(ref);
      if (id !== undefined) assetIds.add(id);
    }

    if (assetIds.size === 0) {
      issues.add({
        code: "selectionSetMembersUnreadable",
        severity: "warning",
        ref: record.ref,
      });
      continue;
    }

    const groupRef = resolveGroupRef(record.groupRef, groupRefs, issues);
    selectionSets.push({
      label: record.label ?? `Selection set ${record.ref}`,
      ...(groupRef === undefined ? {} : { groupRef }),
      assetIds: [...assetIds],
    });
  }

  return { selectionSetGroups, selectionSets };
};

const buildGroups = (
  records: SelectionSetGroupData[],
  issues: IssueCollector,
): BuiltSelectionSetGroup[] => {
  const recordByRef = new Map<string, SelectionSetGroupData>();
  for (const record of records) {
    if (recordByRef.has(record.ref)) {
      groupUnreadable(issues, record.ref);
      continue;
    }
    recordByRef.set(record.ref, record);
  }

  const parentByRef = new Map<string, string | undefined>();
  for (const [ref, record] of recordByRef) {
    parentByRef.set(
      ref,
      resolveGroupRef(record.parentRef, recordByRef, issues, ref),
    );
  }

  for (const ref of recordByRef.keys()) {
    if (isInLoop(ref, parentByRef)) {
      parentByRef.set(ref, undefined);
      groupUnreadable(issues, ref);
    }
  }

  const childrenByParent = new Map<string | undefined, string[]>();
  for (const [ref, parentRef] of parentByRef) {
    const children = childrenByParent.get(parentRef) ?? [];
    children.push(ref);
    childrenByParent.set(parentRef, children);
  }

  const groups: BuiltSelectionSetGroup[] = [];
  const pending = [...(childrenByParent.get(undefined) ?? [])].reverse();
  while (pending.length > 0) {
    const ref = pending.pop()!;
    const parentRef = parentByRef.get(ref);
    groups.push({
      ref,
      label: recordByRef.get(ref)!.label,
      ...(parentRef === undefined ? {} : { parentRef }),
    });
    pending.push(...[...(childrenByParent.get(ref) ?? [])].reverse());
  }

  return groups;
};

const isInLoop = (
  ref: string,
  parentByRef: Map<string, string | undefined>,
): boolean => {
  const seen = new Set<string>();
  let current = parentByRef.get(ref);
  while (current !== undefined && !seen.has(current)) {
    if (current === ref) return true;
    seen.add(current);
    current = parentByRef.get(current);
  }
  return false;
};

const resolveGroupRef = (
  groupRef: string | undefined,
  known: { has: (ref: string) => boolean },
  issues: IssueCollector,
  issueRef?: string,
): string | undefined => {
  if (groupRef === undefined || known.has(groupRef)) return groupRef;

  groupUnreadable(issues, issueRef ?? groupRef);
  return undefined;
};

const groupUnreadable = (issues: IssueCollector, ref: string) =>
  issues.add({ code: "selectionSetGroupUnreadable", severity: "warning", ref });
