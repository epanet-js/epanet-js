import {
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import clsx from "clsx";
import { FieldArray, Form, Formik } from "formik";
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
} from "src/analysis/symbolization-ramp";
import { translate } from "src/infra/i18n";
import toast from "react-hot-toast";
import { useCallback, useMemo, useState } from "react";
import { dataAtom } from "src/state/jotai";
import { Asset } from "src/hydraulic-model";
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
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { RangeColorMapping } from "src/analysis/range-color-mapping";

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

  const onChange = (newSymbolization: ISymbolizationRamp) => {
    if (geometryType === "nodes") {
      setNodesAnalysis({
        type: newSymbolization.property as NodesAnalysis["type"],
        rangeColorMapping:
          RangeColorMapping.fromSymbolizationRamp(newSymbolization),
      });
    } else {
      setLinksAnalysis({
        type: newSymbolization.property as LinksAnalysis["type"],
        rangeColorMapping:
          RangeColorMapping.fromSymbolizationRamp(newSymbolization),
      });
    }
  };

  const sortedData = useMemo(() => {
    const values: number[] = [];
    for (const asset of [...assets.values()]) {
      const value = asset[initialSymbolization.property as keyof Asset];
      if (value === undefined || value === null || typeof value !== "number")
        continue;

      values.push(value);
    }

    return values.sort((a, b) => a - b);
  }, [assets, geometryType, initialSymbolization.property]);

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
  }, [assets, symbolization.property, symbolization.stops, sortedData]);

  const [error, setError] = useState<string | null>(null);

  const validateAscendingOrder = (candidates: ISymbolizationRamp["stops"]) => {
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].input < candidates[i - 1].input) {
        return false;
      }
    }
    return true;
  };

  const updateState = useCallback(
    (newSymbolization: ISymbolizationRamp) => {
      setSymbolization(newSymbolization);
      const isValid = validateAscendingOrder(newSymbolization.stops);
      if (!isValid) {
        setError(translate("rampShouldBeAscending"));
        toast.error(translate("unableToUpdate"), {
          id: "symbolization",
        });
      } else {
        setError(null);
        toast.success(translate("updated"), {
          id: "symbolization",
        });
        onChange(newSymbolization);
      }
    },
    [onChange],
  );

  const handleStopColorChange = (index: number, color: string) => {
    updateState(changeStopColor(symbolization, index, color));
  };

  const handleStopValueChange = (index: number, value: number) => {
    updateState(changeStopValue(symbolization, index, value));
  };

  const handlePrependStop = () => {
    const newSymbolization = prependStop(symbolization);
    updateState(newSymbolization);
  };

  const handleAppendStop = () => {
    const newSymbolization = appendStop(symbolization);
    updateState(newSymbolization);
  };

  const handleReverseColors = () => {
    updateState(reverseColors(symbolization));
  };

  const handleDeleteStop = (index: number) => {
    updateState(deleteStop(symbolization, index));
  };

  const handleRampSizeChange = (rampSize: number) => {
    if (!sortedData.length) {
      setError(translate("notEnoughData"));
      return;
    }
    updateState(changeRampSize(symbolization, sortedData, rampSize));
  };

  const handleRampChange = (newRampName: string, isReversed: boolean) => {
    updateState(changeRampName(symbolization, newRampName, isReversed));
  };

  const handleModeChange = (newMode: RampMode) => {
    if (!sortedData.length) {
      setError(translate("notEnoughData"));
      return;
    }
    updateState(applyMode(symbolization, newMode, sortedData));
  };

  const rampSize = symbolization.stops.length as RampSize;
  const canAddMore = rampSize < maxRampSize;
  const canDeleteStop = rampSize > minRampSize;

  return (
    <div>
      <Formik onSubmit={() => {}} initialValues={{}}>
        {() => {
          return (
            <Form className="space-y-4">
              <FieldArray name="stops">
                {() => (
                  <>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-y-2 w-full">
                        <span className="text-sm text-gray-500">Mode</span>
                        <ModeSelector
                          rampMode={symbolization.mode}
                          onModeChange={handleModeChange}
                        />
                      </div>
                      <div className="flex flex-col gap-y-2 w-full">
                        <span className="text-sm text-gray-500">Classes</span>
                        <ClassesSelector
                          rampSize={rampSize}
                          onChange={handleRampSizeChange}
                        />
                      </div>
                      <div className="flex flex-col gap-y-2 w-full">
                        <span className="text-sm text-gray-500">
                          Color Ramp
                        </span>
                        <RampSelector
                          rampColors={symbolization.stops.map((s) => s.output)}
                          rampSize={rampSize}
                          reversedRamp={Boolean(symbolization.reversedRamp)}
                          onRampChange={handleRampChange}
                          onReverse={handleReverseColors}
                        />
                      </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                      <div className="w-full flex flex-row gap-x-4 items-center dark:text-white p-4 bg-gray-50 rounded-sm ">
                        <div className="w-full flex flex-row gap-2 items-start dark:text-white">
                          <div className="flex flex-col gap-1">
                            {symbolization.stops.map((stop, i) => (
                              <div
                                className={clsx(
                                  i === 0 ||
                                    i === symbolization.stops.length - 1
                                    ? "h-[54px]"
                                    : "h-[37.5px]",
                                  "rounded rounded-md padding-1 w-4",
                                )}
                                key={`${stop.input}-${i}`}
                              >
                                <ColorPopover
                                  color={stop.output}
                                  onChange={(color) => {
                                    handleStopColorChange(i, color);
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
                                disabled={!canAddMore}
                                variant="ultra-quiet"
                                className="opacity-60 border-none"
                                onClick={() => handlePrependStop()}
                                aria-label={`Prepend stop`}
                              >
                                <PlusIcon /> Add Break
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
                                    displayValue={localizeDecimal(stop.input)}
                                    onChangeValue={(value) => {
                                      handleStopValueChange(i, value);
                                    }}
                                  />
                                  {symbolization.stops.length > 1 &&
                                  canDeleteStop ? (
                                    <div>
                                      <Button
                                        type="button"
                                        variant="ultra-quiet"
                                        aria-label={`Delete stop ${i - 1}`}
                                        onClick={() => handleDeleteStop(i)}
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
                                disabled={!canAddMore}
                                variant="ultra-quiet"
                                className="text-gray-200 opacity-60 border-none"
                                onClick={() => handleAppendStop()}
                                aria-label={`Append stop`}
                              >
                                <PlusIcon /> Add Break
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      {!!error && (
                        <p className="py-2 text-sm font-semibold text-orange-800">
                          {error}
                        </p>
                      )}
                      {isFeatureOn("FLAG_DEBUG_HISTOGRAM") && (
                        <>
                          <p>
                            Histogram: {JSON.stringify(debugData.histogram)}
                          </p>
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
                        Regenerate Breaks
                      </Button>
                    </div>
                  </>
                )}
              </FieldArray>
            </Form>
          );
        }}
      </Formik>
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
  linear: "Equal Intervals",
  quantiles: "Equal Quantiles",
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
      label: modeLabels[mode],
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

const RampSelector = ({
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
      <Select.Trigger aria-label="ramp select" className={triggerStyles}>
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
      <Select.Content
        position="popper"
        className={contentStyles}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Select.Viewport className="p-1">
          <div className="flex flex-col gap-y-2">
            <div className="pointer-events-auto">
              <div className="py-2 flex flex-col gap-y-3 overflow-y-auto max-h-[320px]">
                <RampChoices
                  label="Continuous"
                  colors={[
                    ...COLORBREWER_SEQUENTIAL,
                    ...CARTO_COLOR_SEQUENTIAL,
                  ]}
                  onSelect={(newRamp) => onRampChange(newRamp, reversedRamp)}
                  size={rampSize}
                  reverse={reversedRamp}
                />
                <RampChoices
                  label="Diverging"
                  colors={[...COLORBREWER_DIVERGING, ...CARTO_COLOR_DIVERGING]}
                  onSelect={(newRamp) => onRampChange(newRamp, reversedRamp)}
                  size={rampSize}
                  reverse={reversedRamp}
                />
              </div>
            </div>
            <div className="w-full p-2">
              <Button variant="quiet" size="full-width" onClick={onReverse}>
                <UpdateIcon className="-rotate-90" /> Reverse Colors
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
    <div className="flex flex-col gap-y-2">
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
