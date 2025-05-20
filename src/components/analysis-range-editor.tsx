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
import find from "lodash/find";
import {
  RangeMode,
  RampSize,
  appendBreak,
  applyMode,
  changeIntervalColor,
  changeRampName,
  changeRangeSize,
  deleteBreak,
  maxIntervals,
  minIntervals,
  nullRampSymbolization,
  prependBreak,
  rangeModes,
  reverseColors,
  updateBreakValue,
  SymbolizationRamp,
  validateAscindingBreaks,
} from "src/analysis/symbolization-ramp";
import { translate } from "src/infra/i18n";
import toast from "react-hot-toast";
import { useCallback, useMemo, useState } from "react";
import { dataAtom } from "src/state/jotai";
import {
  CARTO_COLOR_DIVERGING,
  CARTO_COLOR_SEQUENTIAL,
  CBColors,
  COLORBREWER_ALL,
  COLORBREWER_DIVERGING,
  COLORBREWER_SEQUENTIAL,
} from "src/lib/colorbrewer";
import * as Select from "@radix-ui/react-select";
import { linearGradient } from "src/lib/color";
import { Selector } from "src/components/form/selector";
import * as d3 from "d3-array";
import {
  linksAnalysisAtomDeprecated,
  nodesAnalysisAtomDeprecated,
} from "src/state/analysis-deprecated";
import { getSortedValues } from "src/analysis/analysis-data";
import { useUserTracking } from "src/infra/user-tracking";
import { useAnalysisSettings } from "src/state/analysis";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";

type ErrorType = "rampShouldBeAscending" | "notEnoughData";

export const AnalysisRangeEditor = ({
  geometryType = "nodes",
}: {
  geometryType?: "nodes" | "links";
}) => {
  const {
    hydraulicModel: { assets },
  } = useAtomValue(dataAtom);
  const {
    linksAnalysis,
    nodesAnalysis,
    updateNodesAnalysis,
    updateLinksAnalysis,
  } = useAnalysisSettings();

  const [nodesAnalysisDeprecated, setNodesAnalysisDeprecated] = useAtom(
    nodesAnalysisAtomDeprecated,
  );
  const [linksAnalysisDeprecated, setLinksAnalysisDeprecated] = useAtom(
    linksAnalysisAtomDeprecated,
  );

  const userTracking = useUserTracking();

  let activeAnalysis;
  if (isFeatureOn("FLAG_MEMORIZE")) {
    activeAnalysis = geometryType === "nodes" ? nodesAnalysis : linksAnalysis;
  } else {
    activeAnalysis =
      geometryType === "nodes"
        ? nodesAnalysisDeprecated
        : linksAnalysisDeprecated;
  }

  const initialSymbolization =
    activeAnalysis.type === "none"
      ? nullRampSymbolization
      : activeAnalysis.symbolization;

  const onChange = useCallback(
    (newSymbolization: SymbolizationRamp) => {
      if (geometryType === "nodes") {
        isFeatureOn("FLAG_MEMORIZE")
          ? updateNodesAnalysis({
              type: activeAnalysis.type as NodesAnalysis["type"],
              symbolization: newSymbolization,
            })
          : setNodesAnalysisDeprecated((prev) => ({
              ...prev,
              symbolization: newSymbolization,
            }));
      } else {
        isFeatureOn("FLAG_MEMORIZE")
          ? updateLinksAnalysis({
              type: activeAnalysis.type as LinksAnalysis["type"],
              symbolization: newSymbolization,
            })
          : setLinksAnalysisDeprecated((prev) => ({
              ...prev,
              symbolization: newSymbolization,
            }));
      }
    },
    [
      activeAnalysis.type,
      geometryType,
      setLinksAnalysisDeprecated,
      setNodesAnalysisDeprecated,
      updateNodesAnalysis,
      updateLinksAnalysis,
    ],
  );

  const sortedData = useMemo(() => {
    return getSortedValues(assets, initialSymbolization.property, {
      absValues: Boolean(initialSymbolization.absValues),
    });
  }, [assets, initialSymbolization.property, initialSymbolization.absValues]);

  const [symbolization, setSymbolization] =
    useState<SymbolizationRamp>(initialSymbolization);

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
      -Infinity,
      ...symbolization.breaks,
      +Infinity,
    ]);
  }, [symbolization.breaks, sortedData]);

  const [error, setError] = useState<ErrorType | null>(null);

  const submitChange = (newSymbolization: SymbolizationRamp) => {
    toast.success(translate("updated"), {
      id: "symbolization",
    });
    onChange(newSymbolization);
  };

  const showError = (error: ErrorType, newSymbolization: SymbolizationRamp) => {
    userTracking.capture({
      name: "analysis.rangeError.seen",
      errorKey: error,
      property: newSymbolization.property,
      mode: newSymbolization.mode,
      classesCount: newSymbolization.colors.length,
    });
    setError(error);
    toast.error(translate("unableToUpdate"), { id: "symbolization" });
  };

  const clearError = () => {
    setError(null);
  };

  const handleModeChange = (newMode: RangeMode) => {
    userTracking.capture({
      name: "analysis.rangeMode.changed",
      mode: newMode,
      property: symbolization.property,
    });
    const result = applyMode(symbolization, newMode, sortedData);
    setSymbolization(result.symbolization);
    if (result.error) {
      showError("notEnoughData", result.symbolization);
    } else {
      clearError();
      submitChange(result.symbolization);
    }
  };

  const handleRangeSizeChange = (numIntervals: number) => {
    userTracking.capture({
      name: "analysis.classes.changed",
      classesCount: numIntervals,
      property: symbolization.property,
    });

    const result = changeRangeSize(symbolization, sortedData, numIntervals);
    setSymbolization(result.symbolization);
    if (result.error) {
      showError("notEnoughData", result.symbolization);
    } else {
      clearError();
      submitChange(result.symbolization);
    }
  };

  const handleIntervalColorChange = (index: number, color: string) => {
    userTracking.capture({
      name: "analysis.intervalColor.changed",
      property: symbolization.property,
    });

    const newSymbolization = changeIntervalColor(symbolization, index, color);
    setSymbolization(newSymbolization);

    if (!error) {
      submitChange(newSymbolization);
    }
  };

  const handleBreakUpdate = (index: number, value: number) => {
    userTracking.capture({
      name: "analysis.break.updated",
      breakValue: value,
      property: symbolization.property,
    });

    const newSymbolization = updateBreakValue(symbolization, index, value);
    setSymbolization(newSymbolization);

    const isValid = validateAscindingBreaks(newSymbolization.breaks);
    if (!isValid) {
      showError("rampShouldBeAscending", newSymbolization);
    } else {
      clearError();
      submitChange(newSymbolization);
    }
  };

  const handleDeleteBreak = (index: number) => {
    userTracking.capture({
      name: "analysis.break.deleted",
      property: symbolization.property,
    });

    const newSymbolization = deleteBreak(symbolization, index);
    setSymbolization(newSymbolization);

    const isValid = validateAscindingBreaks(newSymbolization.breaks);
    if (!isValid) {
      showError("rampShouldBeAscending", newSymbolization);
    } else {
      clearError();
      submitChange(newSymbolization);
    }
  };

  const handlePrependBreak = () => {
    userTracking.capture({
      name: "analysis.break.prepended",
      property: symbolization.property,
    });

    const newSymbolization = prependBreak(symbolization);
    setSymbolization(newSymbolization);
    if (!error) {
      submitChange(newSymbolization);
    }
  };

  const handleAppendBreak = () => {
    userTracking.capture({
      name: "analysis.break.appended",
      property: symbolization.property,
    });

    const newSymbolization = appendBreak(symbolization);
    setSymbolization(newSymbolization);
    if (!error) {
      submitChange(newSymbolization);
    }
  };

  const handleReverseColors = () => {
    userTracking.capture({
      name: "analysis.colorRamp.reversed",
      rampName: symbolization.rampName,
      property: symbolization.property,
    });

    const newSymbolization = reverseColors(symbolization);
    setSymbolization(newSymbolization);
    if (!error) submitChange(newSymbolization);
  };

  const handleRampChange = (newRampName: string, isReversed: boolean) => {
    userTracking.capture({
      name: "analysis.colorRamp.changed",
      rampName: newRampName,
      property: symbolization.property,
    });

    const newSymbolization = changeRampName(
      symbolization,
      newRampName,
      isReversed,
    );
    setSymbolization(newSymbolization);
    if (!error) submitChange(newSymbolization);
  };

  const handleRegenerate = () => {
    userTracking.capture({
      name: "analysis.breaks.regenerated",
      property: symbolization.property,
    });
    const result = applyMode(symbolization, symbolization.mode, sortedData);
    setSymbolization(result.symbolization);
    if (result.error) {
      showError("notEnoughData", result.symbolization);
    } else {
      clearError();
      submitChange(result.symbolization);
    }
  };

  const numIntervals = symbolization.breaks.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-y-2 w-full">
          <span className="text-sm text-gray-500">{translate("mode")}</span>
          <ModeSelector
            rangeMode={symbolization.mode}
            onModeChange={handleModeChange}
          />
        </div>
        <div className="flex flex-col gap-y-2 w-full">
          <span className="text-sm text-gray-500">{translate("classes")}</span>
          <ClassesSelector
            numIntervals={numIntervals}
            onChange={handleRangeSizeChange}
          />
        </div>
        {error !== "notEnoughData" && (
          <div className="flex flex-col gap-y-2 w-full">
            <span className="text-sm text-gray-500">
              {translate("colorRamp")}
            </span>
            <ColorRampSelector
              rampColors={symbolization.colors}
              size={numIntervals as RampSize}
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
              <IntervalsEditor
                numIntervals={numIntervals}
                breaks={symbolization.breaks}
                colors={symbolization.colors}
                absValues={Boolean(symbolization.absValues)}
                onAppend={handleAppendBreak}
                onPrepend={handlePrependBreak}
                onDelete={handleDeleteBreak}
                onChangeColor={handleIntervalColorChange}
                onChangeBreak={handleBreakUpdate}
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
              onClick={handleRegenerate}
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

const IntervalsEditor = ({
  numIntervals,
  breaks,
  colors,
  absValues,
  onChangeColor,
  onChangeBreak,
  onPrepend,
  onAppend,
  onDelete,
}: {
  numIntervals: number;
  breaks: number[];
  colors: string[];
  absValues: boolean;
  onChangeColor: (index: number, color: string) => void;
  onChangeBreak: (index: number, value: number) => void;
  onPrepend: () => void;
  onAppend: () => void;
  onDelete: (index: number) => void;
}) => {
  const canAddMore = numIntervals < maxIntervals;
  const canDelete = numIntervals > minIntervals;

  return (
    <div className="w-full flex flex-row gap-2 items-start dark:text-white">
      <div className="flex flex-col gap-1">
        {colors.map((color, i) => (
          <div
            className={clsx(
              i === 0 || i === colors.length - 1 ? "h-[54px]" : "h-[37.5px]",
              "rounded rounded-md padding-1 w-4",
            )}
            key={`${color}-${i}`}
          >
            <ColorPopover
              color={color}
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
            aria-label={translate("addBreak")}
          >
            <PlusIcon /> {translate("addBreak")}
          </Button>
        </div>
        {breaks.map((breakValue, i) => {
          return (
            <div
              className="flex w-full items-center gap-1"
              key={`${breakValue}-${i}`}
            >
              <NumericField
                key={`break-${i}`}
                label={`break ${i}`}
                isNullable={true}
                readOnly={false}
                positiveOnly={Boolean(absValues)}
                displayValue={localizeDecimal(breakValue)}
                onChangeValue={(value) => {
                  onChangeBreak(i, value);
                }}
              />
              {canDelete ? (
                <div>
                  <Button
                    tabIndex={2}
                    type="button"
                    variant="ultra-quiet"
                    aria-label={`${translate("delete")} ${i}`}
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
            aria-label={translate("addBreak")}
          >
            <PlusIcon /> {translate("addBreak")}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ClassesSelector = ({
  numIntervals,
  onChange,
}: {
  numIntervals: number;
  onChange: (numIntervals: number) => void;
}) => {
  const options = useMemo(() => {
    return d3.range(3, maxIntervals + 1).map((count) => ({
      label: String(count),
      value: String(count),
    }));
  }, []);

  return (
    <Selector
      options={options}
      selected={String(numIntervals)}
      ariaLabel={translate("classes")}
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
  rangeMode,
  onModeChange,
}: {
  rangeMode: RangeMode;
  onModeChange: (newMode: RangeMode) => void;
}) => {
  const modeOptions = useMemo(() => {
    return rangeModes.map((mode) => ({
      label: translate(modeLabels[mode]),
      value: mode,
    }));
  }, []);

  return (
    <Selector
      options={modeOptions}
      selected={rangeMode}
      ariaLabel={translate("mode")}
      onChange={(newMode) => {
        onModeChange(newMode);
      }}
    />
  );
};

const ColorRampSelector = ({
  rampColors,
  size,
  onRampChange,
  reversedRamp,
  onReverse,
}: {
  rampColors: string[];
  size: keyof CBColors["colors"];
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
                size={size}
                reverse={reversedRamp}
              />
              <RampChoices
                label={translate("divergingRamp")}
                colors={[...COLORBREWER_DIVERGING, ...CARTO_COLOR_DIVERGING]}
                onSelect={(newRamp) => onRampChange(newRamp, reversedRamp)}
                size={size}
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

function RampChoice({
  ramp,
  size = 7,
  reverse = false,
  onSelect,
}: {
  ramp: CBColors;
  reverse?: boolean;
  onSelect?: (name: string) => void;
  size?: keyof CBColors["colors"];
}) {
  return (
    <label
      key={ramp.name}
      className="hover:cursor-pointer hover:ring-1 dark:ring-white ring-gray-200 focus:ring-purple-300"
      onClick={() => onSelect && onSelect(ramp.name)}
      tabIndex={1}
    >
      <RampPreview
        name={ramp.name}
        classes={size}
        interpolate={"step"}
        reverse={reverse}
      />
    </label>
  );
}

const DEFAULT_CLASSES = 7;

function RampPreview({
  name,
  interpolate,
  classes,
  reverse = false,
}: {
  name: string;
  reverse?: boolean;
  interpolate: "linear" | "step";
  classes: number;
}) {
  const ramp = find(COLORBREWER_ALL, { name })!;
  const colors =
    ramp.colors[classes as keyof CBColors["colors"]]! ||
    ramp.colors[DEFAULT_CLASSES];

  return (
    <div
      title={name}
      className={clsx("w-full h-5 rounded-md", { "rotate-180": reverse })}
      style={{
        background: linearGradient({
          colors,
          interpolate,
        }),
      }}
    />
  );
}
