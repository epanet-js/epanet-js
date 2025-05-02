import {
  MixerVerticalIcon,
  Pencil1Icon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { DoneButton, RampChoices } from "../panels/symbolization_editor";
import { useAtom, useAtomValue } from "jotai";
import { analysisAtom } from "src/state/analysis";
import { Fragment, useCallback, useMemo, useState } from "react";
import { ISymbolizationRamp } from "src/types";
import {
  Button,
  PopoverContent2,
  StyledLabelSpan,
  StyledPopoverArrow,
  styledSelect,
} from "../elements";
import { dataAtom } from "src/state/jotai";
import { ErrorMessage, FieldArray, Form, Formik } from "formik";
import {
  CARTO_COLOR_DIVERGING,
  CARTO_COLOR_SEQUENTIAL,
  CBColors,
  COLORBREWER_ALL,
  COLORBREWER_DIVERGING,
  COLORBREWER_SEQUENTIAL,
} from "src/lib/colorbrewer";
import * as d3 from "d3-array";
import { lerp } from "src/lib/utils";
import * as P from "@radix-ui/react-popover";
import { InlineError } from "../inline_error";
import { ColorPopover } from "../color-popover";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { Asset } from "src/hydraulic-model";
import { translate, translateUnit } from "src/infra/i18n";
import { NumericField } from "../form/numeric-field";

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
      <div className="flex-auto overflow-y-auto placemark-scrollbar">
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

const generateLinearStops = (dataValues: number[], colors: string[]) => {
  const values = dataValues.length > 1 ? dataValues : [0, 100];
  const [min, max] = d3.extent(values) as [number, number];
  return colors.map((output, i, arr) => {
    return {
      input: Number(+lerp(min, max, i / (arr.length - 1)).toFixed(4)),
      output,
    };
  });
};

const generateQuantileStops = (dataValues: number[], colors: string[]) => {
  const values = dataValues.length > 1 ? dataValues : [0, 100];
  const stops = colors
    .map((output, i, arr) => {
      return {
        input: Number(
          (d3.quantile(values, i / (arr.length - 1)) || 0).toFixed(4),
        ),
        output,
      };
    })
    // Quantile stops could be repeated. Make sure they aren't.
    .filter((stop, i, stops) => {
      if (i === 0) return true;
      if (stops[i - 1].input === stop.input) return false;
      return true;
    });

  return stops;
};

const RampWizard = ({
  symbolization,
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

  const [stops, setStops] = useState<ISymbolizationRamp["stops"]>(
    symbolization.stops,
  );

  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (newSymbolization: ISymbolizationRamp) => {
      setError(null);
      onChange(newSymbolization);
    },
    [onChange],
  );

  const validateAscendingOrder = (candidates: ISymbolizationRamp["stops"]) => {
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].input < candidates[i - 1].input) {
        return false;
      }
    }
    return true;
  };

  const handleStopColorChange = (index: number, color: string) => {
    const newStops = symbolization.stops.map((stop, i) => {
      if (i !== index) return stop;

      return { ...stop, output: color };
    });

    setStops(newStops);
    submit({
      ...symbolization,
      stops: newStops,
    });
  };

  const handleStopValueChange = (index: number, value: number) => {
    const newStops = symbolization.stops.map((stop, i) => {
      if (i !== index) return stop;

      return { ...stop, input: value };
    });

    setStops(newStops);
    const isValid = validateAscendingOrder(newStops);
    if (!isValid) {
      setError(translate("rampShouldBeAscending"));
    } else {
      submit({
        ...symbolization,
        stops: newStops,
      });
    }
  };

  const handleStepsCountChange = (value: number) => {
    const ramp = COLORBREWER_ALL.find(
      (ramp) => ramp.name === symbolization.rampName,
    )!;

    const colors = ramp.colors[value as keyof CBColors["colors"]] as string[];
    const dataValues = options.get(symbolization.property)! || [];
    const newStops = generateLinearStops(dataValues, colors);

    setStops(newStops);
    submit({
      ...symbolization,
      stops: newStops,
    });
  };

  const handleRampChange = (newRampName: string) => {
    const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === newRampName)!;

    const count = symbolization.stops.length;
    const colors = ramp.colors[count as keyof CBColors["colors"]] as string[];
    const dataValues = options.get(symbolization.property)! || [];
    const newStops = generateLinearStops(dataValues, colors);

    setStops(newStops);
    submit({
      ...symbolization,
      rampName: newRampName,
      stops: newStops,
    });
  };

  const handleChangeToEqualIntervals = () => {
    const ramp = COLORBREWER_ALL.find(
      (ramp) => ramp.name === symbolization.rampName,
    )!;

    const count = symbolization.stops.length;
    const colors = ramp.colors[count as keyof CBColors["colors"]] as string[];
    const dataValues = options.get(symbolization.property)! || [];
    const newStops = generateLinearStops(dataValues, colors);

    setStops(newStops);
    submit({
      ...symbolization,
      stops: newStops,
    });
  };

  const handleChangeToQuantiles = () => {
    const ramp = COLORBREWER_ALL.find(
      (ramp) => ramp.name === symbolization.rampName,
    )!;

    const count = symbolization.stops.length;
    const colors = ramp.colors[count as keyof CBColors["colors"]] as string[];
    const dataValues = options.get(symbolization.property)! || [];
    const newStops = generateQuantileStops(dataValues, colors);

    setStops(newStops);
    submit({
      ...symbolization,
      stops: newStops,
    });
  };

  const rampSize = symbolization.stops.length as keyof CBColors["colors"];

  return (
    <div>
      <Formik onSubmit={() => {}} initialValues={{}}>
        {() => {
          return (
            <Form className="space-y-4">
              <FieldArray name="stops">
                {() => (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div>
                      <div
                        className="w-full grid gap-2 items-center dark:text-white"
                        style={{
                          gridTemplateColumns: "1fr 1fr",
                        }}
                      >
                        {stops.map((stop, i) => {
                          return (
                            <Fragment key={`${stop.input}-${i}`}>
                              <ColorPopover
                                color={stop.output}
                                onChange={(color) => {
                                  handleStopColorChange(i, color);
                                }}
                                ariaLabel={`color for step ${i}`}
                              />
                              <NumericField
                                key={`step-${i}`}
                                label={`step ${i}`}
                                isNullable={false}
                                readOnly={false}
                                displayValue={String(stop.input)}
                                onChangeValue={(value) => {
                                  handleStopValueChange(i, value);
                                }}
                              />
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <div>
                        <Button
                          size="full-width"
                          onClick={handleChangeToEqualIntervals}
                        >
                          <PlusIcon /> Equal Intervals
                        </Button>
                      </div>
                      <div>
                        <Button
                          size="full-width"
                          onClick={handleChangeToQuantiles}
                        >
                          <PlusIcon /> Equal Quantiles
                        </Button>
                      </div>
                      <div>
                        <RampSelector
                          rampSize={rampSize}
                          onRampChange={handleRampChange}
                          onStepsCountChange={handleStepsCountChange}
                        />
                      </div>
                      {!!error && (
                        <div>
                          <p className="py-2 text-sm font-semibold text-orange-800">
                            {error}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </FieldArray>
              <ErrorMessage name={`stops`} component={InlineError} />
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

const RampSelector = ({
  rampSize,
  onRampChange,
  onStepsCountChange,
}: {
  rampSize: keyof CBColors["colors"];
  onRampChange: (rampName: string) => void;
  onStepsCountChange: (count: number) => void;
}) => {
  return (
    <P.Root>
      <P.Trigger asChild>
        <Button size="full-width">
          <Pencil1Icon /> Change Color Ramp
        </Button>
      </P.Trigger>
      <PopoverContent2 side="right">
        <StyledPopoverArrow />
        <div
          style={{
            maxHeight: 480,
          }}
          className="space-y-2 p-1 overflow-y-auto placemark-scrollbar"
        >
          <div className="grid grid-cols-2 gap-x-2">
            <label className="block">
              <StyledLabelSpan>Classes</StyledLabelSpan>
              <select
                className={styledSelect({ size: "sm" }) + " w-full"}
                onChange={(event) => {
                  const numericValue = Number(event.target.value);
                  onStepsCountChange(numericValue);
                }}
              >
                {d3.range(3, 8).map((count) => {
                  return (
                    <option
                      key={count}
                      value={String(count)}
                      selected={count === rampSize}
                    >
                      {count}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
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
          <DoneButton />
        </div>
      </PopoverContent2>
    </P.Root>
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
    val.sort();
  }
  return numericPropertyMap;
}
