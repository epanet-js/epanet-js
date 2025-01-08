import { CoordProps, IWrappedFeature } from "src/types";
import { MultiPair, extractMultiProperties } from "src/lib/multi_properties";
import { KeyboardEventHandler, useCallback, useRef, useState } from "react";
import sortBy from "lodash/sortBy";
import { PanelDetails } from "../panel_details";
import { pluralize } from "src/lib/utils";
import { onArrow } from "src/lib/arrow_navigation";
import { PropertyTableHead } from "./AssetEditor";
import { localizeDecimal, translate, translateUnit } from "src/infra/i18n";
import * as P from "@radix-ui/react-popover";
import {
  PropertyRowValue,
  coordPropsAttr,
} from "./feature_editor/property_row/value";
import { PropertyRow } from "./feature_editor/property_row";
import { CardStackIcon } from "@radix-ui/react-icons";
import { StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { JsonValue } from "type-fest";
import { useVirtual } from "react-virtual";
import { Quantities } from "src/model-metadata/quantities-spec";

export default function MultiAssetEditor({
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
  const propertyMap = extractMultiProperties(selectedFeatures);
  const localOrder = useRef<PropertyKey[]>(Array.from(propertyMap.keys()));

  const pairs = sortBy(Array.from(propertyMap.entries()), ([key]) =>
    localOrder.current.indexOf(key),
  );

  return (
    <PanelDetails
      title={`${pluralize("asset", selectedFeatures.length)}`}
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

const PropertyRowMulti = ({
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

  const unit = quantitiesMetadata.getDefaultUnit(property);
  const label = unit
    ? `${translate(property)} (${translateUnit(unit)})`
    : `${translate(property)}`;

  const hasMulti = values.size > 1;
  const { value } = values.keys().next();

  return (
    <PropertyRow label={label} y={y} even={even}>
      {hasMulti ? (
        <MultiValueField
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

function MultiValueField({ pair, onAccept, x, y }: MultiValueProps) {
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
            <ValueList pair={pair} onAccept={onAccept} />
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
  onAccept: (arg0: JsonValue | undefined) => void;
};
function ValueList({ pair }: Omit<MultiValueProps, "x" | "y">) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const values = Array.from(pair[1].entries());

  const rowVirtualizer = useVirtual({
    size: values.length,
    parentRef,
    estimateSize: useCallback(() => 28, []),
  });

  return (
    <div>
      <div className="pb-2 text-xs text-gray-500 font-bold">
        {translate("values")}
      </div>
      <div ref={parentRef} className="max-h-32 overflow-y-auto">
        <div
          className="w-full relative rounded"
          style={{
            height: `${rowVirtualizer.totalSize}px`,
          }}
        >
          {rowVirtualizer.virtualItems.map((virtualRow, i) => {
            const [value, times] = values[virtualRow.index];
            const isEven = i % 2 == 0;
            return (
              <button
                type="button"
                key={virtualRow.index}
                className={`top-0 left-0 block text-left w-full absolute py-1 px-2 flex items-center
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
                <div
                  className="text-xs font-mono"
                  title="Features with this value"
                >
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
