import {
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { ColorPopover } from "src/components/color-popover";
import { Button } from "src/components/elements";
import { NumericField } from "src/components/form/numeric-field";
import { isFeatureOn } from "src/infra/feature-flags";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { ISymbolizationRamp } from "src/types";
import {
  RampMode,
  RampSize,
  appendStop,
  applyMode,
  changeRampName,
  changeRampSize,
  changeStopColor,
  changeStopValue,
  deleteStop,
  maxRampSize,
  minRampSize,
  nullRampSymbolization,
  prependStop,
  rampModes,
  reverseColors,
  validateAscendingOrder,
} from "src/analysis/symbolization-ramp";
import { translate } from "src/infra/i18n";
import toast from "react-hot-toast";
import { useCallback, useMemo, useState } from "react";
import { dataAtom } from "src/state/jotai";
import {
  CARTO_COLOR_DIVERGING,
  CARTO_COLOR_SEQUENTIAL,
  CBColors,
  COLORBREWER_DIVERGING,
  COLORBREWER_SEQUENTIAL,
} from "src/lib/colorbrewer";
import { RampChoice } from "src/components/panels/symbolization_editor";
import * as Select from "@radix-ui/react-select";
import { linearGradient } from "src/lib/color";
import { Selector } from "src/components/form/selector";
import * as d3 from "d3-array";
import { linksAnalysisAtom, nodesAnalysisAtom } from "src/state/analysis";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { getSortedValues } from "src/analysis/analysis-data";

type ErrorType = "rampShouldBeAscending" | "notEnoughData";

export const AnalysisRangeEditor = ({
  geometryType = "nodes",
}: {
  geometryType?: "nodes" | "links";
}) => {
  const {
    hydraulicModel: { assets },
  } = useAtomValue(dataAtom);
  const [nodesAnalysis, setNodesAnalysis] = useAtom(nodesAnalysisAtom);
  const [linksAnalysis, setLinksAnalysis] = useAtom(linksAnalysisAtom);

  const activeAnalysis =
    geometryType === "nodes" ? nodesAnalysis : linksAnalysis;

  const initialSymbolization =
    activeAnalysis.type === "none"
      ? nullRampSymbolization
      : activeAnalysis.rangeColorMapping.symbolization;

  const onChange = useCallback(
    (newSymbolization: ISymbolizationRamp) => {
      if (geometryType === "nodes") {
        setNodesAnalysis((prev) => ({
          ...prev,
          rangeColorMapping:
            RangeColorMapping.fromSymbolizationRamp(newSymbolization),
        }));
      } else {
        setLinksAnalysis((prev) => ({
          ...prev,
          rangeColorMapping:
            RangeColorMapping.fromSymbolizationRamp(newSymbolization),
        }));
      }
    },
    [geometryType, setLinksAnalysis, setNodesAnalysis],
  );

  const sortedData = useMemo(() => {
    return getSortedValues(assets, initialSymbolization.property, {
      absValues: Boolean(initialSymbolization.absValues),
    });
  }, [assets, initialSymbolization.property, initialSymbolization.absValues]);

  const [symbolization, setSymbolization] =
    useState<ISymbolizationRamp>(initialSymbolization);

  const debugData = useMemo(() => {
    if (!isFeatureOn("FLAG_DEBUG_HISTOGRAM"))
      return { histogram: [], min: 0, max: 0 };

    function createHistogram(values: number[], breaks: number[]) {
      const histogram = new Array(breaks.length - 1).fill(0);
      let valueIndex = 0;

      const min = values[0];
      const max = values[values.length - 1];

      for (let bin = 0; bin < breaks.length - 1; bin++) {
        const left = breaks[bin];
        const right = breaks[bin + 1];

        while (valueIndex < values.length && values[valueIndex] <= right) {
          if (values[valueIndex] > left) {
            histogram[bin]++;
          }
          valueIndex++;
        }
      }

      return { histogram, min, max };
    }

    return createHistogram(sortedData, [
      ...symbolization.stops.map((s) => s.input),
      +Infinity,
    ]);
  }, [symbolization.stops, sortedData]);

  const [error, setError] = useState<ErrorType | null>(null);

  const submitChange = (newSymbolization: ISymbolizationRamp) => {
    toast.success(translate("updated"), {
      id: "symbolization",
    });
    onChange(newSymbolization);
  };

  const handleModeChange = (newMode: RampMode) => {
    const result = applyMode(symbolization, newMode, sortedData);
    setSymbolization(result.symbolization);
    if (result.error) {
      setError("notEnoughData");
    } else {
      setError(null);
      submitChange(result.symbolization);
    }
  };

  const handleRampSizeChange = (rampSize: number) => {
    const result = changeRampSize(symbolization, sortedData, rampSize);
    setSymbolization(result.symbolization);
    if (result.error) {
      setError("notEnoughData");
    } else {
      setError(null);
      submitChange(result.symbolization);
    }
  };

  const handleStopColorChange = (index: number, color: string) => {
    const newSymbolization = changeStopColor(symbolization, index, color);
    setSymbolization(newSymbolization);

    if (!error) {
      submitChange(newSymbolization);
    }
  };

  const handleStopValueChange = (index: number, value: number) => {
    const newSymbolization = changeStopValue(symbolization, index, value);
    setSymbolization(newSymbolization);

    const isValid = validateAscendingOrder(newSymbolization.stops);
    if (!isValid) {
      setError("rampShouldBeAscending");
    } else {
      setError(null);
      submitChange(newSymbolization);
    }
  };

  const handleDeleteStop = (index: number) => {
    const newSymbolization = deleteStop(symbolization, index);
    setSymbolization(newSymbolization);

    const isValid = validateAscendingOrder(newSymbolization.stops);
    if (!isValid) {
      setError("rampShouldBeAscending");
    } else {
      setError(null);
      submitChange(newSymbolization);
    }
  };

  const handlePrependStop = () => {
    const newSymbolization = prependStop(symbolization);
    setSymbolization(newSymbolization);
    if (!error) {
      submitChange(newSymbolization);
    }
  };

  const handleAppendStop = () => {
    const newSymbolization = appendStop(symbolization);
    setSymbolization(newSymbolization);
    if (!error) {
      submitChange(newSymbolization);
    }
  };

  const handleReverseColors = () => {
    const newSymbolization = reverseColors(symbolization);
    setSymbolization(newSymbolization);
    if (!error) submitChange(newSymbolization);
  };

  const handleRampChange = (newRampName: string, isReversed: boolean) => {
    const newSymbolization = changeRampName(
      symbolization,
      newRampName,
      isReversed,
    );
    setSymbolization(newSymbolization);
    if (!error) submitChange(newSymbolization);
  };

  const rampSize = symbolization.stops.length as RampSize;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-y-2 w-full">
          <span className="text-sm text-gray-500">{translate("mode")}</span>
          <ModeSelector
            rampMode={symbolization.mode}
            onModeChange={handleModeChange}
          />
        </div>
        <div className="flex flex-col gap-y-2 w-full">
          <span className="text-sm text-gray-500">{translate("classes")}</span>
          <ClassesSelector
            rampSize={rampSize}
            onChange={handleRampSizeChange}
          />
        </div>
        {error !== "notEnoughData" && (
          <div className="flex flex-col gap-y-2 w-full">
            <span className="text-sm text-gray-500">
              {translate("colorRamp")}
            </span>
            <ColorRampSelector
              rampColors={symbolization.stops.map((s) => s.output)}
              rampSize={rampSize}
              reversedRamp={Boolean(symbolization.reversedRamp)}
              onRampChange={handleRampChange}
              onReverse={handleReverseColors}
            />
          </div>
        )}
      </div>

      {error === "notEnoughData" && (
        <p className="py-2 text-sm font-semibold text-orange-800">
          {translate(error)}
        </p>
      )}

      {error !== "notEnoughData" && (
        <>
          <div className="max-h-[400px] overflow-y-auto">
            <div className="w-full flex flex-row gap-x-4 items-center dark:text-white p-4 bg-gray-50 rounded-sm ">
              <RangeEditor
                symbolization={symbolization}
                onAppend={handleAppendStop}
                onPrepend={handlePrependStop}
                onDelete={handleDeleteStop}
                onChangeColor={handleStopColorChange}
                onChangeValue={handleStopValueChange}
              />
            </div>
          </div>
          <div>
            {error && (
              <p className="py-2 text-sm font-semibold text-orange-800">
                {translate(error)}
              </p>
            )}
            {isFeatureOn("FLAG_DEBUG_HISTOGRAM") && (
              <>
                <p>Histogram: {JSON.stringify(debugData.histogram)}</p>
                <p>Min: {debugData.min}</p>
                <p>Max: {debugData.max}</p>
              </>
            )}
          </div>
          <div className="flex flex-col items-center w-full gap-y-2">
            <Button
              className="text-center"
              size="full-width"
              onClick={() => handleModeChange(symbolization.mode)}
            >
              <UpdateIcon />
              {translate("regenerate")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

const RangeEditor = ({
  symbolization,
  onChangeColor,
  onChangeValue,
  onPrepend,
  onAppend,
  onDelete,
}: {
  symbolization: ISymbolizationRamp;
  onChangeColor: (index: number, color: string) => void;
  onChangeValue: (index: number, value: number) => void;
  onPrepend: () => void;
  onAppend: () => void;
  onDelete: (index: number) => void;
}) => {
  const rampSize = symbolization.stops.length as RampSize;
  const canAddMore = rampSize < maxRampSize;
  const canDeleteStop = rampSize > minRampSize;

  return (
    <div className="w-full flex flex-row gap-2 items-start dark:text-white">
      <div className="flex flex-col gap-1">
        {symbolization.stops.map((stop, i) => (
          <div
            className={clsx(
              i === 0 || i === symbolization.stops.length - 1
                ? "h-[54px]"
                : "h-[37.5px]",
              "rounded rounded-md padding-1 w-4",
            )}
            key={`${stop.input}-${i}`}
          >
            <ColorPopover
              color={stop.output}
              onChange={(color) => {
                onChangeColor(i, color);
              }}
              ariaLabel={`color ${i}`}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-full">
          <Button
            type="button"
            tabIndex={1}
            disabled={!canAddMore}
            variant="ultra-quiet"
            className="opacity-60 border-none"
            onClick={onPrepend}
            aria-label={`Prepend stop`}
          >
            <PlusIcon /> {translate("addBreak")}
          </Button>
        </div>
        {symbolization.stops.map((stop, i) => {
          if (i === 0) return null;

          return (
            <div
              className="flex w-full items-center gap-1"
              key={`${stop.input}-${i}`}
            >
              <NumericField
                key={`step-${i - 1}`}
                label={`step ${i - 1}`}
                isNullable={true}
                readOnly={false}
                positiveOnly={Boolean(symbolization.absValues)}
                displayValue={localizeDecimal(stop.input)}
                onChangeValue={(value) => {
                  onChangeValue(i, value);
                }}
              />
              {symbolization.stops.length > 1 && canDeleteStop ? (
                <div>
                  <Button
                    tabIndex={2}
                    type="button"
                    variant="ultra-quiet"
                    aria-label={`Delete stop ${i - 1}`}
                    onClick={() => onDelete(i)}
                  >
                    <TrashIcon className="opacity-60" />
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="w-full">
          <Button
            type="button"
            tabIndex={1}
            disabled={!canAddMore}
            variant="ultra-quiet"
            className="text-gray-200 opacity-60 border-none"
            onClick={onAppend}
            aria-label={`Append stop`}
          >
            <PlusIcon /> {translate("addBreak")}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ClassesSelector = ({
  rampSize,
  onChange,
}: {
  rampSize: number;
  onChange: (rampSize: number) => void;
}) => {
  const options = useMemo(() => {
    return d3.range(3, maxRampSize + 1).map((count) => ({
      label: String(count),
      value: String(count),
    }));
  }, []);

  return (
    <Selector
      options={options}
      selected={String(rampSize)}
      ariaLabel="ramp size"
      onChange={(newValue) => {
        onChange(Number(newValue));
      }}
    />
  );
};

const modeLabels = {
  equalIntervals: "equalIntervals",
  equalQuantiles: "equalQuantiles",
  manual: "manual",
  prettyBreaks: "prettyBreaks",
  ckmeans: "naturalBreaksCkMeans",
};

const ModeSelector = ({
  rampMode,
  onModeChange,
}: {
  rampMode: RampMode;
  onModeChange: (newMode: RampMode) => void;
}) => {
  const modeOptions = useMemo(() => {
    return rampModes.map((mode) => ({
      label: translate(modeLabels[mode]),
      value: mode,
    }));
  }, []);

  return (
    <Selector
      options={modeOptions}
      selected={rampMode}
      ariaLabel="ramp mode"
      onChange={(newMode) => {
        onModeChange(newMode);
      }}
    />
  );
};

const ColorRampSelector = ({
  rampColors,
  rampSize,
  onRampChange,
  reversedRamp,
  onReverse,
}: {
  rampColors: string[];
  rampSize: keyof CBColors["colors"];
  reversedRamp: boolean;
  onRampChange: (rampName: string, isReversed: boolean) => void;
  onReverse: () => void;
}) => {
  const triggerStyles = `flex items-center gap-x-2 border rounded-sm text-sm text-gray-700 dark:items-center justify-between w-full min-w-[90px] focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10 px-2 py-2 min-h-9`;

  const contentStyles = `bg-white w-[--radix-select-trigger-width] border text-sm rounded-sm shadow-md z-50`;

  return (
    <Select.Root>
      <Select.Trigger
        tabIndex={1}
        aria-label="ramp select"
        className={triggerStyles}
      >
        <span
          className="cursor-pointer w-full h-5 border rounded-md"
          style={{
            background: linearGradient({
              colors: rampColors,
              interpolate: "step",
            }),
          }}
        ></span>
        <span className="px-1">
          <ChevronDownIcon />
        </span>
      </Select.Trigger>
      <Select.Content position="popper" className={contentStyles}>
        <Select.Viewport className="p-1">
          <div className="flex flex-col gap-y-2">
            <div className="py-2 flex flex-col gap-y-3 overflow-y-auto max-h-[320px]">
              <RampChoices
                label={translate("continuousRamp")}
                colors={[...COLORBREWER_SEQUENTIAL, ...CARTO_COLOR_SEQUENTIAL]}
                onSelect={(newRamp) => onRampChange(newRamp, reversedRamp)}
                size={rampSize}
                reverse={reversedRamp}
              />
              <RampChoices
                label={translate("divergingRamp")}
                colors={[...COLORBREWER_DIVERGING, ...CARTO_COLOR_DIVERGING]}
                onSelect={(newRamp) => onRampChange(newRamp, reversedRamp)}
                size={rampSize}
                reverse={reversedRamp}
              />
            </div>
            <div className="w-full p-2">
              <Button variant="quiet" size="full-width" onClick={onReverse}>
                <UpdateIcon className="-rotate-90" />{" "}
                {translate("reverseColors")}
              </Button>
            </div>
          </div>
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
  );
};

export function RampChoices({
  label,
  colors,
  onSelect,
  size,
  reverse,
}: {
  label: string;
  colors: CBColors[];
  onSelect?: (name: string) => void;
  size: keyof CBColors["colors"];
  reverse: boolean;
}) {
  return (
    <div className="flex flex-col gap-y-2 p-2">
      <span className="text-xs font-semibold text-gray-600 select-none">
        {label.toUpperCase()}
      </span>
      <div className="flex flex-col gap-y-2">
        {colors.map((ramp) => {
          return (
            <RampChoice
              key={ramp.name}
              ramp={ramp}
              size={size}
              onSelect={onSelect}
              reverse={reverse}
            />
          );
        })}
      </div>
    </div>
  );
}
