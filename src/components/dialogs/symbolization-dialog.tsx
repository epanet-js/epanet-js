import { CaretDownIcon, ColorWheelIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import debounce from "lodash/debounce";
import {
  DoneButton,
  RampChoices,
  RampPreview,
} from "../panels/symbolization_editor";
import { useAtom, useAtomValue } from "jotai";
import { analysisAtom } from "src/state/analysis";
import { Fragment, useCallback, useMemo, useState } from "react";
import { ISymbolizationRamp } from "src/types";
import {
  PopoverContent2,
  StyledLabelSpan,
  StyledPopoverArrow,
  StyledPopoverTrigger,
  inputClass,
  styledSelect,
} from "../elements";
import { dataAtom } from "src/state/jotai";
import {
  ErrorMessage,
  Field,
  FieldArray,
  FieldProps,
  Form,
  Formik,
} from "formik";
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
import { ColorPopover } from "../color_popover";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { Asset } from "src/hydraulic-model";
import { translate, translateUnit } from "src/infra/i18n";

export const SymbolizationDialog = () => {
  return (
    <>
      <DialogHeader title="Symbolization" titleIcon={ColorWheelIcon} />
      <SymbolizationEditor />
    </>
  );
};

export function SymbolizationEditor() {
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

  return (
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
  );
}

const generateLinearStops = (dataValues: number[], colors: string[]) => {
  const values = dataValues.length > 1 ? dataValues : [0, 100];
  const [min, max] = d3.extent(values) as [number, number];
  return colors.map((output, i, arr) => {
    return {
      input: +lerp(min, max, i / (arr.length - 1)).toFixed(4),
      output,
    };
  });
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

  const debouncedSubmit = useCallback(
    debounce((newSymbolization: ISymbolizationRamp) => {
      onChange(newSymbolization);
    }, 100),
    [onChange],
  );

  const handleStopColorChange = (index: number, color: string) => {
    const newStops = symbolization.stops.map((stop, i) => {
      if (i !== index) return stop;

      return { ...stop, output: color };
    });

    setStops(newStops);
    debouncedSubmit({
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
    debouncedSubmit({
      ...symbolization,
      stops: newStops,
    });
  };

  const handleStepsCountChange = (value: number) => {
    const ramp = COLORBREWER_ALL.find(
      (ramp) => ramp.name === symbolization.rampName,
    )!;

    const colors = ramp.colors[value as keyof CBColors["colors"]] as string[];
    const dataValues = options.get(symbolization.property)! || [];
    const newStops = generateLinearStops(dataValues, colors);

    setStops(newStops);
    debouncedSubmit({
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
    debouncedSubmit({
      ...symbolization,
      rampName: newRampName,
      stops: newStops,
    });
  };

  const handlePropertyChange = (property: string) => {
    const ramp = COLORBREWER_ALL.find(
      (ramp) => ramp.name === symbolization.rampName,
    )!;
    const count = symbolization.stops.length;
    const colors = ramp.colors[count as keyof CBColors["colors"]] as string[];
    const dataValues = options.get(property)! || [];
    const newStops = generateLinearStops(dataValues, colors);

    setStops(newStops);
    debouncedSubmit({
      ...symbolization,
      property,
      stops: newStops,
    });
  };

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
                      <div className="font-normal pb-4">
                        {translate(symbolization.property)}{" "}
                        {symbolization.unit
                          ? `(${translateUnit(symbolization.unit)})`
                          : ""}
                      </div>
                      <div
                        className="w-full grid gap-2 items-center dark:text-white"
                        style={{
                          gridTemplateColumns: "1fr 1fr",
                        }}
                      >
                        {stops.map((stop, i) => {
                          return (
                            <Fragment key={i}>
                              <ColorPopover
                                color={stop.output}
                                onChange={(color) => {
                                  handleStopColorChange(i, color);
                                }}
                              />
                              <input
                                className={inputClass({ _size: "sm" })}
                                value={stop.input}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  const numericValue = Number(value);
                                  if (isNaN(numericValue)) return;

                                  handleStopValueChange(i, numericValue);
                                }}
                              />
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block">
                        <div className="">
                          <StyledLabelSpan>Input property</StyledLabelSpan>
                        </div>
                        <select
                          className={styledSelect({ size: "sm" }) + " w-full"}
                          name="property"
                          onChange={(event) => {
                            handlePropertyChange(event.target.value);
                          }}
                        >
                          {Array.from(options.keys(), (cat) => {
                            return (
                              <option
                                key={cat}
                                value={cat}
                                selected={cat === symbolization.property}
                              >
                                {cat}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <div>
                        <StyledLabelSpan>Ramp</StyledLabelSpan>
                        <Field name="rampName">
                          {(fieldProps: FieldProps<string>) => {
                            return (
                              <P.Root>
                                <StyledPopoverTrigger>
                                  <RampPreview
                                    name={symbolization.rampName}
                                    classes={
                                      symbolization.stops
                                        .length as keyof CBColors["colors"]
                                    }
                                    interpolate={symbolization.interpolate}
                                  />
                                  <CaretDownIcon className="w-5 h-5 flex-shrink-0" />
                                </StyledPopoverTrigger>
                                <PopoverContent2 side="left">
                                  <StyledPopoverArrow />
                                  <div
                                    style={{
                                      maxHeight: 480,
                                    }}
                                    className="space-y-2 p-1 overflow-y-auto placemark-scrollbar"
                                  >
                                    <div className="grid grid-cols-2 gap-x-2">
                                      <label className="block">
                                        <StyledLabelSpan>
                                          Classes
                                        </StyledLabelSpan>
                                        <select
                                          className={
                                            styledSelect({ size: "sm" }) +
                                            " w-full"
                                          }
                                          onChange={(event) => {
                                            const numericValue = Number(
                                              event.target.value,
                                            );
                                            handleStepsCountChange(
                                              numericValue,
                                            );
                                          }}
                                        >
                                          {d3.range(3, 8).map((count) => {
                                            return (
                                              <option
                                                key={count}
                                                value={String(count)}
                                                selected={
                                                  count ===
                                                  symbolization.stops.length
                                                }
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
                                        fieldProps={fieldProps}
                                        onSelect={handleRampChange}
                                      />
                                      <RampChoices
                                        label="Continuous (CARTO Colors)"
                                        colors={CARTO_COLOR_SEQUENTIAL}
                                        fieldProps={fieldProps}
                                        onSelect={handleRampChange}
                                      />
                                    </div>
                                    <div>
                                      <RampChoices
                                        label="Diverging (ColorBrewer)"
                                        colors={COLORBREWER_DIVERGING}
                                        fieldProps={fieldProps}
                                        onSelect={handleRampChange}
                                      />
                                      <RampChoices
                                        label="Diverging (CARTO Colors)"
                                        colors={CARTO_COLOR_DIVERGING}
                                        onSelect={handleRampChange}
                                        fieldProps={fieldProps}
                                      />
                                    </div>
                                    <DoneButton />
                                  </div>
                                </PopoverContent2>
                              </P.Root>
                            );
                          }}
                        </Field>
                      </div>
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
