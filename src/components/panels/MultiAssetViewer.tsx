import { IWrappedFeature } from "src/types";
import { MultiPair } from "src/lib/multi_properties";
import { KeyboardEventHandler, useRef, useState } from "react";
import { PanelDetails } from "../panel_details";
import { pluralize } from "src/lib/utils";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyTableHead } from "./AssetEditor";
import { translate, translateUnit } from "src/infra/i18n";
import * as P from "@radix-ui/react-popover";
import { PropertyRowValue } from "./feature_editor/property_row/value";
import { PropertyRow } from "./feature_editor/property_row";
import { CardStackIcon } from "@radix-ui/react-icons";
import { StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { JsonValue } from "type-fest";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Quantities, UnitsSpec } from "src/model-metadata/quantities-spec";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  PropertyStats,
  QuantityStats,
  computePropertyStats,
} from "./asset-property-stats";
import { Asset } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";

export default function MultiAssetViewer({
  selectedFeatures,
  quantitiesMetadata,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
}) {
  return (
    <>
      <div className="overflow-auto">
        <FeatureEditorPropertiesMulti
          selectedFeatures={selectedFeatures}
          quantitiesMetadata={quantitiesMetadata}
        />
      </div>
      <div className="flex-auto" />
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-t border-gray-200 dark:border-gray-900 overflow-auto placemark-scrollbar"></div>
    </>
  );
}

export function FeatureEditorPropertiesMulti({
  selectedFeatures,
  quantitiesMetadata,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
}) {
  const propertyMap = computePropertyStats(
    selectedFeatures as Asset[],
    quantitiesMetadata,
  );
  const pairs = Array.from(propertyMap.entries());

  return (
    <PanelDetails
      title={`${translate("selection")} (${pluralize("asset", selectedFeatures.length)})`}
      variant="fullwidth"
    >
      <table className="ppb-2 b-2 w-full" data-focus-scope onKeyDown={onArrow}>
        <PropertyTableHead />
        <tbody>
          {pairs.map((pair) => {
            return (
              <PropertyRowMulti
                key={pair[0]}
                pair={pair}
                quantitiesMetadata={quantitiesMetadata}
              />
            );
          })}
        </tbody>
      </table>
    </PanelDetails>
  );
}
const PropertyRowMulti = ({
  pair,
  quantitiesMetadata,
}: {
  pair: [string, PropertyStats];
  quantitiesMetadata: Quantities;
}) => {
  const [property, stats] = pair;

  const unit = quantitiesMetadata.getUnit(property as keyof UnitsSpec);
  const label = unit
    ? `${translate(property)} (${translateUnit(unit)})`
    : `${translate(property)}`;

  const hasMulti = stats.values.size > 1;
  const { value } = stats.values.keys().next();

  return (
    <PropertyRow label={label}>
      {hasMulti ? (
        <MultiValueField
          property={property}
          pair={[label, stats.values]}
          propertyStats={stats}
          onAccept={() => {}}
        />
      ) : (
        <PropertyRowValue
          readOnly={true}
          pair={[label, formatValue(value)]}
          onChangeValue={() => {}}
          onDeleteKey={() => {}}
          onCast={() => {}}
        />
      )}
    </PropertyRow>
  );
};

function MultiValueField({ property, pair, propertyStats }: MultiValueProps) {
  const [label, value] = pair;
  const [isOpen, setOpen] = useState(false);
  const userTracking = useUserTracking();

  const handleContentKeyDown: KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const handleTriggerKeyDown: KeyboardEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    if (event.code === "Enter" && !isOpen) {
      setOpen(true);
      event.stopPropagation();
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    userTracking.capture({
      name: "propertyAggregate.opened",
      property,
    });
    setOpen(isOpen);
  };

  return (
    <div>
      <P.Root open={isOpen} onOpenChange={handleOpenChange}>
        <P.Trigger
          aria-label={`Values for: ${label}`}
          onKeyDown={handleTriggerKeyDown}
          className="group
          text-left font-mono
          text-xs px-1.5 py-2
          text-gray-700

          focus-visible:ring-inset
          focus-visible:ring-1
          focus-visible:ring-purple-500
          aria-expanded:ring-1
          aria-expanded:ring-purple-500

          gap-x-1 block w-full
          dark:text-white bg-transparent
          flex overflow-hidden"
        >
          <CardStackIcon />
          {pluralize("value", value.size)}
        </P.Trigger>
        <P.Portal>
          <StyledPopoverContent onKeyDown={handleContentKeyDown}>
            <StyledPopoverArrow />
            {propertyStats.type === "quantity" && (
              <QuantityStatsFields quantityStats={propertyStats} />
            )}
            <ValueList pair={pair} />
          </StyledPopoverContent>
        </P.Portal>
      </P.Root>
    </div>
  );
}

const QuantityStatsFields = ({
  quantityStats,
}: {
  quantityStats: QuantityStats;
}) => {
  const [tabIndex, setTabIndex] = useState(-1);
  const handleFocus = () => {
    setTabIndex(0);
  };
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 pb-4">
      {["min", "max", "mean", "sum"].map((metric, i) => {
        const label = translate(metric);
        return (
          <div
            key={i}
            className="flex flex-col items-space-betweenjustify-center"
          >
            <span
              role="textbox"
              aria-label={`Key: ${label}`}
              className="pb-1 text-xs text-gray-500 font-bold"
            >
              {label}
            </span>
            <input
              role="textbox"
              aria-label={`Value for: ${label}`}
              className="text-xs font-mono px-2 py-2 bg-gray-100 border-none focus-visible:ring-inset focus-visible:ring-purple-500 focus-visible:bg-purple-300/10"
              readOnly
              tabIndex={tabIndex}
              onFocus={handleFocus}
              value={localizeDecimal(
                quantityStats[metric as keyof QuantityStats] as number,
              )}
            />
          </div>
        );
      })}
    </div>
  );
};

const formatValue = (value: JsonValue | undefined): string => {
  if (value === undefined) return "";
  if (typeof value === "number") {
    return localizeDecimal(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);

  return translate(value);
};

type MultiValueProps = {
  property: string;
  pair: MultiPair;
  propertyStats: PropertyStats;
  onAccept: (arg0: JsonValue | undefined) => void;
};

const itemSize = 32;

const testSize = { width: 400, height: 400 };

function ValueList({ pair }: { pair: MultiPair }) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const values = Array.from(pair[1].entries());

  const rowVirtualizer = useVirtualizer({
    count: values.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
    overscan: 5,
    initialRect: testSize,
  });

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return;

    event.stopPropagation();
    rowVirtualizer.scrollBy(event.code === "ArrowDown" ? itemSize : -itemSize);
    parentRef.current && parentRef.current.focus();
  };

  return (
    <div>
      <div className="pb-2 text-xs text-gray-500 font-bold">
        {translate("values")}
      </div>
      <div
        ref={parentRef}
        onKeyDown={handleKeyDown}
        className="max-h-32 overflow-y-auto"
      >
        <div
          className="w-full relative rounded"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const [value, times] = values[virtualRow.index];
            return (
              <button
                type="button"
                key={virtualRow.index}
                role="button"
                aria-label={`Value row: ${value as number}`}
                className={`top-0 left-0 block text-left w-full absolute py-2 px-2 flex items-center
                hover:bg-gray-200 dark:hover:bg-gray-700
                gap-x-2 cursor-default even:bg-gray-100`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex-auto font-mono text-xs truncate">
                  {formatValue(value)}
                </div>
                <div className="text-xs font-mono" title={translate("assets")}>
                  ({localizeDecimal(times)})
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
