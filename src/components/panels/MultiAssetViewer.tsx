import { CoordProps, IWrappedFeature } from "src/types";
import { MultiPair, extractMultiProperties } from "src/lib/multi_properties";
import { KeyboardEventHandler, useRef, useState } from "react";
import sortBy from "lodash/sortBy";
import { PanelDetails } from "../panel_details";
import { pluralize } from "src/lib/utils";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyTableHead } from "./AssetEditor";
import { translate, translateUnit } from "src/infra/i18n";
import * as P from "@radix-ui/react-popover";
import {
  PropertyRowValue,
  coordPropsAttr,
} from "./feature_editor/property_row/value";
import { PropertyRow } from "./feature_editor/property_row";
import { CardStackIcon } from "@radix-ui/react-icons";
import { StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { JsonValue } from "type-fest";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Quantities, UnitsSpec } from "src/model-metadata/quantities-spec";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { isFeatureOn } from "src/infra/feature-flags";
import {
  PropertyStats,
  QuantityStats,
  computePropertyStats,
} from "./asset-property-stats";
import { Asset } from "src/hydraulic-model";

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
        {isFeatureOn("FLAG_STATS") && (
          <FeatureEditorPropertiesMulti
            selectedFeatures={selectedFeatures}
            quantitiesMetadata={quantitiesMetadata}
          />
        )}
        {!isFeatureOn("FLAG_STATS") && (
          <FeatureEditorPropertiesMultiDeprecated
            selectedFeatures={selectedFeatures}
            quantitiesMetadata={quantitiesMetadata}
          />
        )}
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
  const localOrder = useRef<PropertyKey[]>(Array.from(propertyMap.keys()));

  const pairs = sortBy(Array.from(propertyMap.entries()), ([key]) =>
    localOrder.current.indexOf(key),
  );

  return (
    <PanelDetails
      title={`${translate("selection")} (${pluralize("asset", selectedFeatures.length)})`}
      variant="fullwidth"
    >
      <table className="ppb-2 b-2 w-full" data-focus-scope onKeyDown={onArrow}>
        <PropertyTableHead />
        <tbody>
          {pairs.map((pair, y) => {
            return (
              <PropertyRowMulti
                y={y}
                key={pair[0]}
                pair={pair}
                even={y % 2 === 0}
                quantitiesMetadata={quantitiesMetadata}
              />
            );
          })}
        </tbody>
      </table>
    </PanelDetails>
  );
}
export function FeatureEditorPropertiesMultiDeprecated({
  selectedFeatures,
  quantitiesMetadata,
}: {
  selectedFeatures: IWrappedFeature[];
  quantitiesMetadata: Quantities;
}) {
  const propertyMap = extractMultiProperties(selectedFeatures);
  const localOrder = useRef<PropertyKey[]>(Array.from(propertyMap.keys()));

  const pairs = sortBy(Array.from(propertyMap.entries()), ([key]) =>
    localOrder.current.indexOf(key),
  );

  return (
    <PanelDetails
      title={`${translate("selection")} (${pluralize("asset", selectedFeatures.length)})`}
      variant="fullwidth"
    >
      <table className="ppb-2 b-2 w-full" data-focus-scope onKeyDown={onArrow}>
        <PropertyTableHead />
        <tbody>
          {pairs.map((pair, y) => {
            return (
              <PropertyRowMultiDeprecated
                y={y}
                key={pair[0]}
                pair={pair}
                even={y % 2 === 0}
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
  even,
  y,
  quantitiesMetadata,
}: {
  pair: [string, PropertyStats];
  even: boolean;
  y: number;
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
    <PropertyRow label={label} y={y} even={even}>
      {hasMulti ? (
        <MultiValueField
          x={1}
          y={y}
          pair={[label, stats.values]}
          propertyStats={stats}
          onAccept={() => {}}
        />
      ) : (
        <PropertyRowValue
          x={1}
          y={y}
          readOnly={true}
          pair={[label, formatValue(value)]}
          onChangeValue={() => {}}
          even={even}
          onDeleteKey={() => {}}
          onCast={() => {}}
        />
      )}
    </PropertyRow>
  );
};

const PropertyRowMultiDeprecated = ({
  pair,
  even,
  y,
  quantitiesMetadata,
}: {
  pair: MultiPair;
  even: boolean;
  y: number;
  quantitiesMetadata: Quantities;
}) => {
  const [property, values] = pair;

  const unit = quantitiesMetadata.getUnit(property as keyof UnitsSpec);
  const label = unit
    ? `${translate(property)} (${translateUnit(unit)})`
    : `${translate(property)}`;

  const hasMulti = values.size > 1;
  const { value } = values.keys().next();

  return (
    <PropertyRow label={label} y={y} even={even}>
      {hasMulti ? (
        <MultiValueFieldDeprecated
          x={1}
          y={y}
          pair={[label, values]}
          onAccept={() => {}}
        />
      ) : (
        <PropertyRowValue
          x={1}
          y={y}
          readOnly={true}
          pair={[label, formatValue(value)]}
          onChangeValue={() => {}}
          even={even}
          onDeleteKey={() => {}}
          onCast={() => {}}
        />
      )}
    </PropertyRow>
  );
};

function MultiValueField({ pair, propertyStats, x, y }: MultiValueProps) {
  const [label, value] = pair;
  const [isOpen, setOpen] = useState(false);

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
    setOpen(isOpen);
  };

  return (
    <div>
      <P.Root open={isOpen} onOpenChange={handleOpenChange}>
        <P.Trigger
          {...coordPropsAttr({ x, y })}
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
            <span
              role="textbox"
              aria-label={`Value for: ${label}`}
              className="text-xs font-mono px-2 py-2 bg-gray-100"
            >
              {localizeDecimal(
                quantityStats[metric as keyof QuantityStats] as number,
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};

function MultiValueFieldDeprecated({ pair, x, y }: MultiValuePropsDeprecated) {
  const [, value] = pair;
  const [isOpen, setOpen] = useState(false);

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
    setOpen(isOpen);
  };

  return (
    <div>
      <P.Root open={isOpen} onOpenChange={handleOpenChange}>
        <P.Trigger
          {...coordPropsAttr({ x, y })}
          aria-label="Multiple values"
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
            <ValueList pair={pair} />
          </StyledPopoverContent>
        </P.Portal>
      </P.Root>
    </div>
  );
}

const formatValue = (value: JsonValue | undefined): string => {
  if (value === undefined) return "";
  if (typeof value === "number") {
    return localizeDecimal(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);

  return translate(value);
};

type MultiValueProps = CoordProps & {
  pair: MultiPair;
  propertyStats: PropertyStats;
  onAccept: (arg0: JsonValue | undefined) => void;
};
type MultiValuePropsDeprecated = CoordProps & {
  pair: MultiPair;
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
          {rowVirtualizer.getVirtualItems().map((virtualRow, i) => {
            const [value, times] = values[virtualRow.index];
            const isEven = i % 2 == 0;
            return (
              <button
                type="button"
                key={virtualRow.index}
                role="button"
                aria-label={`Value row: ${value as number}`}
                className={`top-0 left-0 block text-left w-full absolute py-2 px-2 flex items-center
                hover:bg-gray-200 dark:hover:bg-gray-700
                gap-x-2 cursor-default ${isEven ? "bg-gray-100" : ""} `}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex-auto font-mono text-xs truncate">
                  {formatValue(value)}
                </div>
                <div className="text-xs font-mono" title={translate("assets")}>
                  ({times})
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
