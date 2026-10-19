import type { AssetId } from "@epanet-js/hydraulic-model";
import type { IssueCollector } from "../issues";
import type { SelectionSetData } from "../network-data";

export type BuiltSelectionSet = {
  label: string;
  assetIds: AssetId[];
};

export type SelectionSetLookup = {
  nodeIdByRef: (ref: string) => AssetId | undefined;
  linkIdByRef: (ref: string) => AssetId | undefined;
};

export const buildSelectionSets = (
  records: SelectionSetData[],
  lookup: SelectionSetLookup,
  issues: IssueCollector,
): BuiltSelectionSet[] => {
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

    selectionSets.push({
      label: record.label ?? `Selection set ${record.ref}`,
      assetIds: [...assetIds],
    });
  }

  return selectionSets;
};
