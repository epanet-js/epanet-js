import {
  ChevronDownIcon,
  MixerVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { RampChoices } from "../panels/symbolization_editor";
import { useAtom, useAtomValue } from "jotai";
import { analysisAtom } from "src/state/analysis";
import { useCallback, useMemo, useState } from "react";
import { ISymbolizationRamp } from "src/types";
import { Button } from "../elements";
import { dataAtom } from "src/state/jotai";
import { FieldArray, Form, Formik } from "formik";
import {
  CARTO_COLOR_DIVERGING,
  CARTO_COLOR_SEQUENTIAL,
  CBColors,
  COLORBREWER_DIVERGING,
  COLORBREWER_SEQUENTIAL,
} from "src/lib/colorbrewer";
import * as d3 from "d3-array";
import * as Select from "@radix-ui/react-select";
import { ColorPopover } from "../color-popover";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { Asset } from "src/hydraulic-model";
import { translate, translateUnit } from "src/infra/i18n";
import { NumericField } from "../form/numeric-field";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Selector } from "../form/selector";
import clsx from "clsx";
import {
  appendStop,
  reverseColors,
  prependStop,
  deleteStop,
  changeRampSize,
  changeRampName,
  changeStopColor,
  changeStopValue,
  maxRampSize,
  minRampSize,
  RampSize,
  RampMode,
  rampModes,
  getColors,
  applyRampColors,
  applyMode,
} from "src/analysis/symbolization-ramp";
import { linearGradient } from "src/lib/color";
import { isFeatureOn } from "src/infra/feature-flags";

export const SymbolizationDialog = () => {
  const [{ nodes }, setAnalysis] = useAtom(analysisAtom);

  if (nodes.type === "none") return null;

  const handleChange = (newSymbolization: ISymbolizationRamp) => {
    setAnalysis((prev) => ({
      ...prev,
      nodes: {
        type: "pressures",
        rangeColorMapping:
          RangeColorMapping.fromSymbolizationRamp(newSymbolization),
      },
    }));
  };

  const symbolization = nodes.rangeColorMapping.symbolization;

  let title = translate(symbolization.property);
  if (symbolization.unit) title += ` (${translateUnit(symbolization.unit)})`;

  return (
    <>
      <DialogHeader title={title} titleIcon={MixerVerticalIcon} />
      <div className="flex-auto">
        <div className="divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
          <div className="text-sm">
            <RampWizard
              symbolization={nodes.rangeColorMapping.symbolization}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>
    </>
  );
};

const RampWizard = ({
  symbolization: initialSymbolization,
  onChange,
}: {
  symbolization: ISymbolizationRamp;
  onChange: (newSymbolization: ISymbolizationRamp) => void;
}) => {
  const {
    hydraulicModel: { assets },
  } = useAtomValue(dataAtom);

  const options = useMemo(() => {
    return getNumericPropertyMap([...assets.values()].filter((a) => a.isNode));
  }, [assets]);

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
    const dataValues = options.get(symbolization.property) || [];

    return createHistogram(dataValues, [
      ...symbolization.stops.map((s) => s.input),
      +Infinity,
    ]);
  }, [assets, symbolization.property, symbolization.stops, options]);

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
      } else {
        setError(null);
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
    const dataValues = options.get(symbolization.property)! || [];
    if (!dataValues.length) {
      setError(translate("notEnoughData"));
      return;
    }
    updateState(changeRampSize(symbolization, dataValues, rampSize));
  };

  const handleRampChange = (newRampName: string) => {
    updateState(changeRampName(symbolization, newRampName));
  };

  const handleApplyColors = () => {
    updateState(applyRampColors(symbolization));
  };

  const handleModeChange = (newMode: RampMode) => {
    const dataValues = options.get(symbolization.property)! || [];
    if (!dataValues.length) {
      setError(translate("notEnoughData"));
      return;
    }
    updateState(applyMode(symbolization, newMode, dataValues));
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
                      <div className="grid grid-cols-2 gap-4">
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
                            rampName={symbolization.rampName}
                            rampSize={rampSize}
                            onRampChange={handleRampChange}
                          />
                        </div>
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
                                  className="flex items-center gap-1"
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
                        <div className="min-w-[200px]">
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
                      </div>
                    </div>
                    <div className="flex items-center w-full gap-x-2">
                      <Button
                        className="flex-1 text-center"
                        size="full-width"
                        onClick={() => handleModeChange(symbolization.mode)}
                      >
                        Regenerate Breaks
                      </Button>
                      <Button
                        className="flex-1 text-center"
                        size="full-width"
                        onClick={handleApplyColors}
                      >
                        Reapply Ramp
                      </Button>
                      <Button
                        className="flex-1 text-center"
                        size="full-width"
                        onClick={handleReverseColors}
                      >
                        Reverse Colors
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
  rampName,
  rampSize,
  onRampChange,
}: {
  rampName: string;
  rampSize: keyof CBColors["colors"];
  onRampChange: (rampName: string) => void;
}) => {
  const rampColors = useMemo(() => {
    return getColors(rampName, maxRampSize);
  }, [rampName, rampSize]);

  const triggerStyles = `flex items-center gap-x-2 border rounded-sm text-sm text-gray-700 dark:items-center justify-between w-full min-w-[90px] focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10 px-2 py-2 min-h-9`;

  const contentStyles = `bg-white w-[--radix-select-trigger-width] border text-sm rounded-sm shadow-md z-50`;

  return (
    <Select.Root>
      <Select.Trigger className={triggerStyles}>
        <span
          title={"ramp select"}
          className="cursor-pointer w-full h-5 border rounded-sm"
          style={{
            background: linearGradient({
              colors: rampColors,
              interpolate: "linear",
            }),
          }}
        ></span>
        <span className="px-1">
          <ChevronDownIcon />
        </span>
      </Select.Trigger>
      <Select.Content position="popper" className={contentStyles}>
        <Select.Viewport className="p-1">
          <div className="pointer-events-auto">
            <div className="space-y-2 p-1 overflow-y-auto max-h-[320px]">
              <div>
                <RampChoices
                  label="Continuous (ColorBrewer)"
                  colors={COLORBREWER_SEQUENTIAL}
                  onSelect={onRampChange}
                  size={rampSize}
                />
                <RampChoices
                  label="Continuous (CARTO Colors)"
                  colors={CARTO_COLOR_SEQUENTIAL}
                  onSelect={onRampChange}
                  size={rampSize}
                />
              </div>
              <div>
                <RampChoices
                  label="Diverging (ColorBrewer)"
                  colors={COLORBREWER_DIVERGING}
                  onSelect={onRampChange}
                  size={rampSize}
                />
                <RampChoices
                  label="Diverging (CARTO Colors)"
                  colors={CARTO_COLOR_DIVERGING}
                  onSelect={onRampChange}
                  size={rampSize}
                />
              </div>
            </div>
          </div>
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
  );
};

const nodeProperties = ["pressure", "elevation"];

export function getNumericPropertyMap(assets: Asset[]) {
  const numericPropertyMap = new Map<string, number[]>();
  for (const property of nodeProperties) {
    numericPropertyMap.set(property, []);
  }

  for (const asset of assets) {
    for (const property of nodeProperties) {
      const value = asset[property as keyof Asset];
      if (value === undefined || value === null) continue;

      if (typeof value === "number") {
        const values = numericPropertyMap.get(property) as number[];
        values.push(value);
        numericPropertyMap.set(property, values);
      }
    }
  }

  for (const val of numericPropertyMap.values()) {
    val.sort((a, b) => a - b);
  }
  return numericPropertyMap;
}
