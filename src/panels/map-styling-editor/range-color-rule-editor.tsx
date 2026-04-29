import clsx from "clsx";
import * as DD from "@radix-ui/react-dropdown-menu";
import { ColorPopover } from "src/components/color-popover";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { NumericField } from "src/components/form/numeric-field";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  RangeMode,
  appendBreak,
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
import { useTranslate } from "src/hooks/use-translate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useRegenerateBreaks } from "src/hooks/use-regenerate-breaks";
import { getSortedDataForProperty } from "src/map/symbology/symbology-data-source";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";

import { Selector } from "src/components/form/selector";
import * as d3 from "d3-array";
import { useUserTracking } from "src/infra/user-tracking";
import { useSymbologyState } from "src/state/map-symbology";
import { LinkSymbology, NodeSymbology } from "src/map/symbology";
import { notify } from "src/components/notifications";
import { ErrorIcon, AddIcon, DeleteIcon, RefreshIcon } from "src/icons";

type ErrorType = "rampShouldBeAscending" | "notEnoughData";

export const RangeColorRuleEditor = ({
  geometryType = "node",
}: {
  geometryType?: "node" | "link";
}) => {
  const translate = useTranslate();
  const {
    linkSymbology,
    nodeSymbology,
    updateNodeSymbology,
    updateLinkSymbology,
  } = useSymbologyState();

  const userTracking = useUserTracking();
  const {
    regenerate,
    regenerateFromCurrentStep,
    regenerateFromAllData,
    canRegenerateFromAllData,
    isWorking,
  } = useRegenerateBreaks(geometryType);

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

  const [colorRule, setColorRule] = useState<RangeColorRule>(initialColorRule);

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
    notify({
      variant: "error",
      Icon: ErrorIcon,
      title: translate("invalidRange"),
      description: translate("fixRangeToApply"),
      id: "symbology",
      size: "md",
    });
  };

  const clearError = () => {
    setError(null);
  };

  const handleModeChange = async (newMode: RangeMode) => {
    userTracking.capture({
      name: "colorRange.rangeMode.changed",
      mode: newMode,
      property: colorRule.property,
    });
    const result = await regenerate({ ...colorRule, mode: newMode });
    if (result) applyRegenerateResult(result);
  };

  const handleRangeSizeChange = async (numIntervals: number) => {
    userTracking.capture({
      name: "colorRange.classes.changed",
      classesCount: numIntervals,
      property: colorRule.property,
    });

    const sized = changeRangeSize(colorRule, [], numIntervals);
    const result = await regenerate(sized.colorRule);
    if (result) applyRegenerateResult(result);
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

  const LONG_PRESS_MS = 500;
  const [isRegenerateDropdownOpen, setIsRegenerateDropdownOpen] =
    useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const wasLongPressRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const applyRegenerateResult = (result: {
    colorRule: RangeColorRule;
    error?: boolean;
  }) => {
    setColorRule(result.colorRule);
    if (result.error) {
      showError("notEnoughData", result.colorRule);
    } else {
      clearError();
      submitChange(result.colorRule);
    }
  };

  const handleRegenerate = async () => {
    const result = await regenerate(colorRule);
    if (result) applyRegenerateResult(result);
  };

  const handleRegenerateFromCurrentStep = async () => {
    const result = await regenerateFromCurrentStep(colorRule);
    if (result) applyRegenerateResult(result);
  };

  const handleRegenerateFromAllData = async () => {
    const result = await regenerateFromAllData(colorRule);
    if (result) applyRegenerateResult(result);
  };

  const handleRegeneratePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isWorking) return;
    wasLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      wasLongPressRef.current = true;
      setIsRegenerateDropdownOpen(true);
    }, LONG_PRESS_MS);
  };

  const handleRegeneratePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isWorking) return;
    if (!wasLongPressRef.current && !isRegenerateDropdownOpen) {
      void handleRegenerate();
    }
  };

  const handleRegeneratePointerLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
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
            <DebugHistogram colorRule={colorRule} />
          </div>
          <div className="flex flex-col items-center w-full gap-y-2">
            {canRegenerateFromAllData ? (
              <DD.Root
                open={isRegenerateDropdownOpen}
                onOpenChange={setIsRegenerateDropdownOpen}
              >
                <DD.Trigger asChild>
                  <Button
                    className="text-center text-sm relative"
                    size="full-width"
                    disabled={isWorking}
                    onPointerDown={handleRegeneratePointerDown}
                    onPointerUp={handleRegeneratePointerUp}
                    onPointerLeave={handleRegeneratePointerLeave}
                  >
                    <RefreshIcon
                      className={isWorking ? "animate-spin" : undefined}
                    />
                    {translate("regenerate")}
                    <span
                      className="absolute bottom-1 right-1 border-l-[5px] border-l-transparent border-b-[5px] border-b-gray-400"
                      aria-hidden="true"
                    />
                  </Button>
                </DD.Trigger>
                <DD.Portal>
                  <DDContent align="start" side="top" sideOffset={4}>
                    <StyledItem onSelect={handleRegenerateFromCurrentStep}>
                      {translate("regenerateFromCurrentStep")}
                    </StyledItem>
                    <StyledItem onSelect={handleRegenerateFromAllData}>
                      {translate("regenerateFromAllData")}
                    </StyledItem>
                  </DDContent>
                </DD.Portal>
              </DD.Root>
            ) : (
              <Button
                className="text-center text-sm"
                size="full-width"
                onClick={handleRegenerate}
                disabled={isWorking}
              >
                <RefreshIcon
                  className={isWorking ? "animate-spin" : undefined}
                />
                {translate("regenerate")}
              </Button>
            )}
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
  const translate = useTranslate();
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
            <AddIcon /> {translate("addBreak")}
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
                    <DeleteIcon />
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
            <AddIcon /> {translate("addBreak")}
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
  const translate = useTranslate();
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
  const translate = useTranslate();
  const modeOptions = useMemo(() => {
    return rangeModesInOrder.map((mode) => ({
      label: translate(modeLabels[mode]),
      value: mode,
    }));
  }, [translate]);

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

const DebugHistogram = ({ colorRule }: { colorRule: RangeColorRule }) => {
  const isEnabled = useFeatureFlag("FLAG_DEBUG_HISTOGRAM");
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulationResults = useAtomValue(simulationResultsDerivedAtom);

  const sortedData = useMemo(
    () =>
      getSortedDataForProperty(
        colorRule.property,
        hydraulicModel,
        simulationResults,
        {
          absValues: Boolean(colorRule.absValues),
        },
      ),
    [
      colorRule.property,
      colorRule.absValues,
      hydraulicModel,
      simulationResults,
    ],
  );

  const histogram = useMemo(() => {
    const breaks = [-Infinity, ...colorRule.breaks, +Infinity];
    const bins: number[] = new Array(breaks.length - 1).fill(0);
    let valueIndex = 0;
    for (let bin = 0; bin < breaks.length - 1; bin++) {
      const left = breaks[bin];
      const right = breaks[bin + 1];
      while (
        valueIndex < sortedData.length &&
        sortedData[valueIndex] <= right
      ) {
        if (sortedData[valueIndex] > left) bins[bin]++;
        valueIndex++;
      }
    }
    return bins;
  }, [sortedData, colorRule.breaks]);

  if (!isEnabled) return null;

  return (
    <>
      <p>Histogram: {JSON.stringify(histogram)}</p>
      <p>Min: {sortedData[0]}</p>
      <p>Max: {sortedData[sortedData.length - 1]}</p>
    </>
  );
};
