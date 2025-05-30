import { PlusIcon, TrashIcon, UpdateIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { ColorPopover } from "src/components/color-popover";
import { Button } from "src/components/elements";
import { NumericField } from "src/components/form/numeric-field";
import { isFeatureOn } from "src/infra/feature-flags";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  RangeMode,
  appendBreak,
  applyMode,
  changeIntervalColor,
  changeRangeSize,
  deleteBreak,
  maxIntervals,
  minIntervals,
  nullRangeSymbology,
  prependBreak,
  rangeModesInOrder,
  updateBreakValue,
  RangeSymbology,
  validateAscindingBreaks,
} from "src/analysis/range-symbology";
import { translate } from "src/infra/i18n";
import toast from "react-hot-toast";
import { useCallback, useMemo, useState } from "react";
import { dataAtom } from "src/state/jotai";

import { Selector } from "src/components/form/selector";
import * as d3 from "d3-array";
import { getSortedValues } from "src/analysis/analysis-data";
import { useUserTracking } from "src/infra/user-tracking";
import { useAnalysisState } from "src/state/analysis";
import { LinkSymbology, NodesAnalysis } from "src/analysis";

type ErrorType = "rampShouldBeAscending" | "notEnoughData";

export const RangeSymbologyEditor = ({
  geometryType = "node",
}: {
  geometryType?: "node" | "link";
}) => {
  const {
    hydraulicModel: { assets },
  } = useAtomValue(dataAtom);
  const {
    linksAnalysis,
    nodesAnalysis,
    updateNodesAnalysis,
    updateLinkSymbology,
  } = useAnalysisState();

  const userTracking = useUserTracking();

  const activeAnalysis =
    geometryType === "node" ? nodesAnalysis : linksAnalysis;

  const initialSymbology =
    activeAnalysis.type === "none"
      ? nullRangeSymbology
      : activeAnalysis.symbology;

  const onChange = useCallback(
    (newSymbology: RangeSymbology) => {
      if (geometryType === "node") {
        updateNodesAnalysis({
          ...activeAnalysis,
          symbology: newSymbology,
        } as NodesAnalysis);
      } else {
        updateLinkSymbology({
          ...activeAnalysis,
          symbology: newSymbology,
        } as LinkSymbology);
      }
    },
    [activeAnalysis, geometryType, updateNodesAnalysis, updateLinkSymbology],
  );

  const sortedData = useMemo(() => {
    return getSortedValues(assets, initialSymbology.property, {
      absValues: Boolean(initialSymbology.absValues),
    });
  }, [assets, initialSymbology.property, initialSymbology.absValues]);

  const [symbology, setSymbology] = useState<RangeSymbology>(initialSymbology);

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
      ...symbology.breaks,
      +Infinity,
    ]);
  }, [symbology.breaks, sortedData]);

  const [error, setError] = useState<ErrorType | null>(null);

  const submitChange = (newSymbology: RangeSymbology) => {
    onChange(newSymbology);
  };

  const showError = (error: ErrorType, newSymbology: RangeSymbology) => {
    userTracking.capture({
      name: "colorRange.rangeError.seen",
      errorKey: error,
      property: newSymbology.property,
      mode: newSymbology.mode,
      classesCount: newSymbology.colors.length,
    });
    setError(error);
    toast.error(translate("unableToUpdate"), { id: "symbology" });
  };

  const clearError = () => {
    setError(null);
  };

  const handleModeChange = (newMode: RangeMode) => {
    userTracking.capture({
      name: "colorRange.rangeMode.changed",
      mode: newMode,
      property: symbology.property,
    });
    const result = applyMode(symbology, newMode, sortedData);
    setSymbology(result.symbology);
    if (result.error) {
      showError("notEnoughData", result.symbology);
    } else {
      clearError();
      submitChange(result.symbology);
    }
  };

  const handleRangeSizeChange = (numIntervals: number) => {
    userTracking.capture({
      name: "colorRange.classes.changed",
      classesCount: numIntervals,
      property: symbology.property,
    });

    const result = changeRangeSize(symbology, sortedData, numIntervals);
    setSymbology(result.symbology);
    if (result.error) {
      showError("notEnoughData", result.symbology);
    } else {
      clearError();
      submitChange(result.symbology);
    }
  };

  const handleIntervalColorChange = (index: number, color: string) => {
    userTracking.capture({
      name: "colorRange.intervalColor.changed",
      property: symbology.property,
    });

    const newSymbology = changeIntervalColor(symbology, index, color);
    setSymbology(newSymbology);

    if (!error) {
      submitChange(newSymbology);
    }
  };

  const handleBreakUpdate = (index: number, value: number) => {
    userTracking.capture({
      name: "colorRange.break.updated",
      breakValue: value,
      property: symbology.property,
    });

    const newSymbology = updateBreakValue(symbology, index, value);
    setSymbology(newSymbology);

    const isValid = validateAscindingBreaks(newSymbology.breaks);
    if (!isValid) {
      showError("rampShouldBeAscending", newSymbology);
    } else {
      clearError();
      submitChange(newSymbology);
    }
  };

  const handleDeleteBreak = (index: number) => {
    userTracking.capture({
      name: "colorRange.break.deleted",
      property: symbology.property,
    });

    const newSymbology = deleteBreak(symbology, index);
    setSymbology(newSymbology);

    const isValid = validateAscindingBreaks(newSymbology.breaks);
    if (!isValid) {
      showError("rampShouldBeAscending", newSymbology);
    } else {
      clearError();
      submitChange(newSymbology);
    }
  };

  const handlePrependBreak = () => {
    userTracking.capture({
      name: "colorRange.break.prepended",
      property: symbology.property,
    });

    const newSymbology = prependBreak(symbology);
    setSymbology(newSymbology);
    if (!error) {
      submitChange(newSymbology);
    }
  };

  const handleAppendBreak = () => {
    userTracking.capture({
      name: "colorRange.break.appended",
      property: symbology.property,
    });

    const newSymbology = appendBreak(symbology);
    setSymbology(newSymbology);
    if (!error) {
      submitChange(newSymbology);
    }
  };

  const handleRegenerate = () => {
    userTracking.capture({
      name: "colorRange.breaks.regenerated",
      property: symbology.property,
    });
    const result = applyMode(symbology, symbology.mode, sortedData);
    setSymbology(result.symbology);
    if (result.error) {
      showError("notEnoughData", result.symbology);
    } else {
      clearError();
      submitChange(result.symbology);
    }
  };

  const numIntervals = symbology.breaks.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-y-2 w-full">
          <span className="text-sm text-gray-500">{translate("mode")}</span>
          <ModeSelector
            rangeMode={symbology.mode}
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
                breaks={symbology.breaks}
                colors={symbology.colors}
                absValues={Boolean(symbology.absValues)}
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
            key={i}
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
    return rangeModesInOrder.map((mode) => ({
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
