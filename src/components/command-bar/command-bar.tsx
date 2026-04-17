import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Maybe } from "purify-ts/Maybe";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { commandBarOpenAtom } from "src/state/command-bar";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
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
const MAX_RESULTS = 200;
const recentsByNetwork = new Map<string, SearchOption[]>();

export const CommandBar = () => {
  const isAssetSearchOn = useFeatureFlag("FLAG_ASSET_SEARCH");
  const [isOpen, setOpen] = useAtom(commandBarOpenAtom);

  useHotkeys(
    "ctrl+k",
    (e) => {
      if (e.preventDefault) e.preventDefault();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      setOpen(true);
    },
    [setOpen],
    "Open command bar",
    !isAssetSearchOn,
  );

  if (!isAssetSearchOn || !isOpen) return null;

  return <CommandBarModal onClose={() => setOpen(false)} />;
};

const CommandBarModal = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const customerPoints = useAtomValue(customerPointsAtom);
  const selection = useAtomValue(selectionAtom);
  const fileInfo = useAtomValue(fileInfoAtom);
  const { selectAsset, selectCustomerPoint } = useSelection(selection);
  const zoomTo = useZoomTo();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  const computeResults = useCallback(
    (query: string): SearchOption[] => {
      if (query.trim().length === 0) return getRecents();
      return labelManager
        .search(query, MAX_RESULTS)
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
    },
    [labelManager, getRecents],
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchOption[]>(() =>
    computeResults(""),
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const commit = (option: SearchOption) => {
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
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setResults(computeResults(value));
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0 ? 0 : Math.min(prev + 1, results.length - 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0 ? 0 : Math.max(prev - 1, 0),
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) commit(results[activeIndex]);
    }
  };

  useEffect(function focusInputOnOpen() {
    const id = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(
    function keepActiveItemVisible() {
      const list = listRef.current;
      if (!list) return;
      const item = list.querySelector<HTMLElement>(
        `[data-index="${activeIndex}"]`,
      );
      if (item) item.scrollIntoView({ block: "nearest" });
    },
    [activeIndex],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={translate("assetSearch.placeholder")}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-[560px] max-w-[90vw] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-600 overflow-hidden">
        <div className="flex items-center px-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-gray-400 dark:text-gray-500" aria-hidden>
            <SearchIcon size="lg" />
          </span>
          <input
            ref={inputRef}
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={translate("assetSearch.placeholder")}
            className="flex-1 bg-transparent border-0 px-2 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder:italic placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:border-transparent focus:shadow-none"
          />
        </div>
        <div
          ref={listRef}
          role="listbox"
          aria-label={translate("assetSearch.placeholder")}
          className="max-h-[360px] overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400">
              {query.trim().length > 0
                ? "No results"
                : translate("assetSearch.emptyHint")}
            </div>
          ) : (
            results.map((option, index) => (
              <div
                key={option.id}
                role="option"
                aria-selected={index === activeIndex}
                data-index={index}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(option)}
                className={clsx(
                  "flex items-center justify-between gap-2 px-3 py-2 text-sm rounded cursor-pointer text-gray-900 dark:text-gray-100",
                  index === activeIndex
                    ? "bg-purple-300/40"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700",
                )}
              >
                <span className="truncate">{option.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {option.data.kind === "asset"
                    ? typeLabel(option.data.type)
                    : "Customer Point"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
