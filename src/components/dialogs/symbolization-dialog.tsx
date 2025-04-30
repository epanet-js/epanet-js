import { CaretDownIcon, ColorWheelIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import {
  DoneButton,
  InterpolateOption,
  RampChoices,
  RampPreview,
} from "../panels/symbolization_editor";
import { useAtom, useAtomValue } from "jotai";
import { analysisAtom } from "src/state/analysis";
import { Fragment, useMemo } from "react";
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
import { ColorPopoverField } from "../color_popover";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { Asset } from "src/hydraulic-model";
import { useAutoSubmit } from "src/hooks/use_auto_submit";
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

  return (
    <div>
      <Formik<ISymbolizationRamp & { classes: number }>
        onSubmit={(values) => {
          const ramp = COLORBREWER_ALL.find(
            (ramp) => ramp.name === values.rampName,
          )!;
          const dataValues = options.get(values.property)! || [];
          const colors = ramp.colors[
            values.classes as keyof CBColors["colors"]
          ] as string[];

          function getStopsLinear({ colors }: { colors: string[] }) {
            const [min, max] = d3.extent(dataValues) as [number, number];
            return colors.map((output, i, arr) => {
              return {
                input: +lerp(min, max, i / (arr.length - 1)).toFixed(4),
                output,
              };
            });
          }

          const newSymbolization: ISymbolizationRamp = {
            type: "ramp",
            simplestyle: values.simplestyle,
            property: values.property,
            interpolate: values.interpolate,
            rampName: values.rampName,
            defaultColor: values.defaultColor,
            defaultOpacity: values.defaultOpacity,
            stops: getStopsLinear({ colors }),
          };
          values.stops = newSymbolization.stops;
          onChange(newSymbolization);
        }}
        validate={(values) => {
          const errors: Record<string, string> = {};
          let lastValue: null | number = values.stops[0]?.input;
          for (let i = 1; i < values.stops.length; i++) {
            const thisValue = values.stops[i].input;
            if (thisValue < lastValue) {
              errors[`stops`] =
                "Ramp input values need to be in ascending order.";
            }
            lastValue = thisValue;
          }
          return errors;
        }}
        initialValues={{
          ...symbolization,
          classes: symbolization.stops.length,
        }}
        key={JSON.stringify(symbolization)}
      >
        {({ values }) => {
          return (
            <Form className="space-y-4">
              <AutoSubmit />
              <FieldArray name="stops">
                {() => (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div>
                      <div className="font-normal pb-4">
                        {translate(values.property)}{" "}
                        {values.unit ? `(${translateUnit(values.unit)})` : ""}
                      </div>
                      <div
                        className="w-full grid gap-2 items-center dark:text-white"
                        style={{
                          gridTemplateColumns: "1fr 1fr",
                        }}
                      >
                        {values.stops.map((stop, i) => {
                          return (
                            <Fragment key={`${stop.input}-${stop.output}-${i}`}>
                              <div>
                                <Field
                                  component={ColorPopoverField}
                                  name={`stops.${i}.output`}
                                  _size="sm"
                                  className={inputClass({
                                    _size: "sm",
                                  })}
                                />
                              </div>
                              <div>
                                <Field
                                  name={`stops.${i}.input`}
                                  type="number"
                                  className={inputClass({
                                    _size: "sm",
                                  })}
                                />
                              </div>
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
                        <Field
                          as="select"
                          name="property"
                          className={styledSelect({ size: "sm" }) + " w-full"}
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
                        </Field>
                      </label>
                      <div>
                        <StyledLabelSpan>Ramp</StyledLabelSpan>
                        <Field name="rampName">
                          {(fieldProps: FieldProps<string>) => {
                            const { field, form } = fieldProps;
                            return (
                              <P.Root>
                                <StyledPopoverTrigger>
                                  <RampPreview
                                    name={field.value}
                                    classes={form.values.classes}
                                    interpolate={form.values.interpolate}
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
                                        <Field
                                          as="select"
                                          name="classes"
                                          required
                                          className={
                                            styledSelect({ size: "sm" }) +
                                            " w-full"
                                          }
                                        >
                                          {d3.range(3, 8).map((count) => {
                                            return (
                                              <option
                                                key={count}
                                                value={String(count)}
                                              >
                                                {count}
                                              </option>
                                            );
                                          })}
                                        </Field>
                                      </label>
                                      <label className="block">
                                        <InterpolateOption />
                                      </label>
                                    </div>
                                    <div>
                                      <RampChoices
                                        label="Continuous (ColorBrewer)"
                                        colors={COLORBREWER_SEQUENTIAL}
                                        fieldProps={fieldProps}
                                      />
                                      <RampChoices
                                        label="Continuous (CARTO Colors)"
                                        colors={CARTO_COLOR_SEQUENTIAL}
                                        fieldProps={fieldProps}
                                      />
                                    </div>
                                    <div>
                                      <RampChoices
                                        label="Diverging (ColorBrewer)"
                                        colors={COLORBREWER_DIVERGING}
                                        fieldProps={fieldProps}
                                      />
                                      <RampChoices
                                        label="Diverging (CARTO Colors)"
                                        colors={CARTO_COLOR_DIVERGING}
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

const AutoSubmit = () => {
  useAutoSubmit(300);
  return null;
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
