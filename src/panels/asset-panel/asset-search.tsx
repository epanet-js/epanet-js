import { useAtomValue } from "jotai";
import { Maybe } from "purify-ts/Maybe";
import { useCallback, useRef, useState } from "react";
import { VirtualizedSearchableSelector } from "src/components/form/virtualized-searchable-selector";
import { SearchIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { Asset, AssetId } from "src/hydraulic-model";
import { LabelType } from "src/hydraulic-model/label-manager";
import { USelection } from "src/selection";
import { useSelection } from "src/selection/use-selection";
import { customerPointsAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import { fileInfoAtom } from "src/state/file-system";
import { BBox } from "src/types";

type SearchOption = {
  id: string;
  label: string;
  data:
    | { kind: "asset"; rawId: AssetId; type: Asset["type"] }
    | { kind: "customerPoint"; rawId: number };
};

const searchableAssetTypes: ReadonlySet<LabelType> = new Set<LabelType>([
  "pipe",
  "junction",
  "reservoir",
  "tank",
  "pump",
  "valve",
]);

const typeLabel = (type: Asset["type"]): string => {
  const prefixes: Record<Asset["type"], string> = {
    pipe: "Pipe",
    junction: "Junction",
    reservoir: "Reservoir",
    tank: "Tank",
    pump: "Pump",
    valve: "Valve",
  };
  return prefixes[type];
};

const MAX_RECENTS = 10;
const recentsByNetwork = new Map<string, SearchOption[]>();

export const AssetSearch = () => {
  const translate = useTranslate();
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const customerPoints = useAtomValue(customerPointsAtom);
  const selection = useAtomValue(selectionAtom);
  const fileInfo = useAtomValue(fileInfoAtom);
  const { selectAsset, selectCustomerPoint } = useSelection(selection);
  const zoomTo = useZoomTo();
  const [resetKey, setResetKey] = useState(0);

  const networkKey = fileInfo?.name ?? "";
  const recentsRef = useRef(recentsByNetwork);

  const getRecents = useCallback((): SearchOption[] => {
    const recents = recentsRef.current.get(networkKey) ?? [];
    return recents.filter((option) => {
      if (option.data.kind === "customerPoint") {
        return customerPoints.has(option.data.rawId);
      }
      const assetData = option.data;
      const results = labelManager.search(option.label, 1);
      return results.some(
        (r) => r.id === assetData.rawId && r.type === assetData.type,
      );
    });
  }, [networkKey, labelManager, customerPoints]);

  const addRecent = useCallback(
    (option: SearchOption) => {
      const recents = recentsRef.current.get(networkKey) ?? [];
      const filtered = recents.filter((r) => r.id !== option.id);
      const updated = [option, ...filtered].slice(0, MAX_RECENTS);
      recentsRef.current.set(networkKey, updated);
    },
    [networkKey],
  );

  const onSearch = useCallback(
    (query: string): Promise<SearchOption[]> => {
      if (query.trim().length === 0) {
        return Promise.resolve(getRecents());
      }
      const options = labelManager
        .search(query, 200)
        .filter(
          (entry) =>
            entry.type === "customerPoint" ||
            searchableAssetTypes.has(entry.type),
        )
        .map((entry): SearchOption => {
          if (entry.type === "customerPoint") {
            return {
              id: `c:${entry.id}`,
              label: entry.label,
              data: { kind: "customerPoint", rawId: entry.id },
            };
          }
          return {
            id: `a:${entry.id}`,
            label: entry.label,
            data: {
              kind: "asset",
              rawId: entry.id,
              type: entry.type as Asset["type"],
            },
          };
        });
      return Promise.resolve(options);
    },
    [labelManager, getRecents],
  );

  const onChange = (option: SearchOption) => {
    addRecent(option);
    if (option.data.kind === "asset") {
      selectAsset(option.data.rawId);
      zoomTo(USelection.single(option.data.rawId), 18);
    } else {
      const customerPoint = customerPoints.get(option.data.rawId);
      selectCustomerPoint(option.data.rawId);
      if (customerPoint) {
        const [lng, lat] = customerPoint.coordinates;
        zoomTo(Maybe.of([lng, lat, lng, lat] as BBox), 18);
      }
    }
    setResetKey((k) => k + 1);
  };

  return (
    <VirtualizedSearchableSelector<SearchOption>
      key={resetKey}
      onChange={onChange}
      onSearch={onSearch}
      placeholder={translate("assetSearch.placeholder")}
      leadingIcon={<SearchIcon size="sm" />}
      renderOption={(option) => (
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{option.label}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {option.data.kind === "asset"
              ? typeLabel(option.data.type)
              : "Customer Point"}
          </span>
        </span>
      )}
      wrapperClassName="w-full"
    />
  );
};
