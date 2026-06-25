import clsx from "clsx";
import { useTranslate } from "src/hooks/use-translate";
import {
  CustomAttributeAssetType,
  CustomAttributesDefinition,
  countFor,
} from "src/lib/custom-attributes";

type CustomAttributesSidebarProps = {
  width: number;
  assetTypes: CustomAttributeAssetType[];
  definition: CustomAttributesDefinition;
  selectedAssetType: CustomAttributeAssetType;
  invalidAssetTypes: Set<CustomAttributeAssetType>;
  onSelect: (assetType: CustomAttributeAssetType) => void;
};

export const CustomAttributesSidebar = ({
  width,
  assetTypes,
  definition,
  selectedAssetType,
  invalidAssetTypes,
  onSelect,
}: CustomAttributesSidebarProps) => {
  const translate = useTranslate();

  return (
    <div className="shrink-0 flex flex-col gap-1 py-2" style={{ width }}>
      {assetTypes.map((assetType) => {
        const isSelected = assetType === selectedAssetType;
        const count = countFor(definition, assetType);
        const isInvalid = invalidAssetTypes.has(assetType);
        return (
          <button
            key={assetType}
            type="button"
            onClick={() => onSelect(assetType)}
            className={clsx(
              "flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-size-base text-left",
              isSelected
                ? "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100"
                : "text-default hover:bg-gray-100 dark:hover:bg-gray-800",
            )}
          >
            <span className="truncate">{translate(assetType)}</span>
            <span className="shrink-0 flex items-center gap-1.5">
              {isInvalid && (
                <span
                  className="h-2 w-2 rounded-full bg-current text-warning"
                  aria-hidden="true"
                />
              )}
              <span className="tabular-nums text-subtle">{count}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
