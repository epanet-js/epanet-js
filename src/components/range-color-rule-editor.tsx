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
  nullRangeColorRule,
  prependBreak,
  rangeModesInOrder,
  updateBreakValue,
  RangeColorRule,
  validateAscindingBreaks,
} from "src/map/symbology/range-color-rule";
import { translate } from "src/infra/i18n";
import toast from "react-hot-toast";
import { useCallback, useMemo, useState } from "react";
import { dataAtom } from "src/state/jotai";

import { Selector } from "src/components/form/selector";
import * as d3 from "d3-array";
import { useUserTracking } from "src/infra/user-tracking";
import { useSymbologyState } from "src/state/symbology";
import { LinkSymbology, NodeSymbology } from "src/map/symbology";
import { getSortedValues } from "src/hydraulic-model/assets-map";

type ErrorType = "rampShouldBeAscending" | "notEnoughData";

export const RangeColorRuleEditor = ({
  geometryType = "node",
}: {
  geometryType?: "node" | "link";
}) => {
  const {
    hydraulicModel: { assets },
  } = useAtomValue(dataAtom);
  const {
    linkSymbology,
    nodeSymbology,
    updateNodeSymbology,
    updateLinkSymbology,
  } = useSymbologyState();

  const userTracking = useUserTracking();

  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;

  const initialColorRule = symbology.colorRule
    ? symbology.colorRule
    : nullRangeColorRule;

  const onChange = useCallback(
    (newColorRule: RangeColorRule) => {
      if (geometryType === "node") {
        updateNodeSymbology({
          ...symbology,
          colorRule: newColorRule,
        } as NodeSymbology);
      } else {
        updateLinkSymbology({
          ...symbology,
          colorRule: newColorRule,
        } as LinkSymbology);
      }
    },
    [symbology, geometryType, updateNodeSymbology, updateLinkSymbology],
  );

  const sortedData = useMemo(() => {
    return getSortedValues(assets, initialColorRule.property, {
      absValues: Boolean(initialColorRule.absValues),
    });
  }, [assets, initialColorRule.property, initialColorRule.absValues]);

  const [colorRule, setColorRule] = useState<RangeColorRule>(initialColorRule);

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
      ...colorRule.breaks,
      +Infinity,
    ]);
  }, [colorRule.breaks, sortedData]);

  const [error, setError] = useState<ErrorType | null>(null);

  const submitChange = (newColorRule: RangeColorRule) => {
    onChange(newColorRule);
  };

  const showError = (error: ErrorType, newColorRule: RangeColorRule) => {
    userTracking.capture({
      name: "colorRange.rangeError.seen",
      errorKey: error,
      property: newColorRule.property,
      mode: newColorRule.mode,
      classesCount: newColorRule.colors.length,
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
      property: colorRule.property,
    });
    const result = applyMode(colorRule, newMode, sortedData);
    setColorRule(result.colorRule);
    if (result.error) {
      showError("notEnoughData", result.colorRule);
    } else {
      clearError();
      submitChange(result.colorRule);
    }
  };

  const handleRangeSizeChange = (numIntervals: number) => {
    userTracking.capture({
      name: "colorRange.classes.changed",
      classesCount: numIntervals,
      property: colorRule.property,
    });

    const result = changeRangeSize(colorRule, sortedData, numIntervals);
    setColorRule(result.colorRule);
    if (result.error) {
      showError("notEnoughData", result.colorRule);
    } else {
      clearError();
      submitChange(result.colorRule);
    }
  };

  const handleIntervalColorChange = (index: number, color: string) => {
    userTracking.capture({
      name: "colorRange.intervalColor.changed",
      property: colorRule.property,
    });

    const newColorRule = changeIntervalColor(colorRule, index, color);
    setColorRule(newColorRule);

    if (!error) {
      submitChange(newColorRule);
    }
  };

  const handleBreakUpdate = (index: number, value: number) => {
    userTracking.capture({
      name: "colorRange.break.updated",
      breakValue: value,
      property: colorRule.property,
    });

    const newColorRule = updateBreakValue(colorRule, index, value);
    setColorRule(newColorRule);

    const isValid = validateAscindingBreaks(newColorRule.breaks);
    if (!isValid) {
      showError("rampShouldBeAscending", newColorRule);
    } else {
      clearError();
      submitChange(newColorRule);
    }
  };

  const handleDeleteBreak = (index: number) => {
    userTracking.capture({
      name: "colorRange.break.deleted",
      property: colorRule.property,
    });

    const newColorRule = deleteBreak(colorRule, index);
    setColorRule(newColorRule);

    const isValid = validateAscindingBreaks(newColorRule.breaks);
    if (!isValid) {
      showError("rampShouldBeAscending", newColorRule);
    } else {
      clearError();
      submitChange(newColorRule);
    }
  };

  const handlePrependBreak = () => {
    userTracking.capture({
      name: "colorRange.break.prepended",
      property: colorRule.property,
    });

    const newColorRule = prependBreak(colorRule);
    setColorRule(newColorRule);
    if (!error) {
      submitChange(newColorRule);
    }
  };

  const handleAppendBreak = () => {
    userTracking.capture({
      name: "colorRange.break.appended",
      property: colorRule.property,
    });

    const newColorRule = appendBreak(colorRule);
    setColorRule(newColorRule);
    if (!error) {
      submitChange(newColorRule);
    }
  };

  const handleRegenerate = () => {
    userTracking.capture({
      name: "colorRange.breaks.regenerated",
      property: colorRule.property,
    });
    const result = applyMode(colorRule, colorRule.mode, sortedData);
    setColorRule(result.colorRule);
    if (result.error) {
      showError("notEnoughData", result.colorRule);
    } else {
      clearError();
      submitChange(result.colorRule);
    }
  };

  const numIntervals = colorRule.breaks.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-y-2 w-full">
          <span className="text-sm text-gray-500">{translate("mode")}</span>
          <ModeSelector
            rangeMode={colorRule.mode}
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
                breaks={colorRule.breaks}
                colors={colorRule.colors}
                absValues={Boolean(colorRule.absValues)}
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
