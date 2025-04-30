import {
  CaretDownIcon,
  ColorWheelIcon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import {
  DoneButton,
  InterpolateOption,
  RampChoices,
  RampPreview,
} from "../panels/symbolization_editor";
import { atom, useAtom, useAtomValue } from "jotai";
import { analysisAtom } from "src/state/analysis";
import { Fragment, useMemo, useState } from "react";
import { ISymbolizationRamp, RampValues, Symbolization } from "src/types";
import { PanelDetails } from "../panel_details";
import {
  Button,
  PopoverContent2,
  StyledLabelSpan,
  StyledPopoverArrow,
  StyledPopoverTrigger,
  inputClass,
  styledSelect,
} from "../elements";
import { dataAtom } from "src/state/jotai";
import {
  ArrayHelpers,
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
  COLORBREWER_ALL,
  COLORBREWER_DIVERGING,
  COLORBREWER_SEQUENTIAL,
} from "src/lib/colorbrewer";
import * as d3 from "d3-array";
import { lerp } from "src/lib/utils";
import { colors } from "src/lib/constants";
import * as P from "@radix-ui/react-popover";
import toast from "react-hot-toast";
import { captureError } from "src/infra/error-tracking";
import { InlineError } from "../inline_error";
import { ColorPopoverField } from "../color_popover";
import last from "lodash/last";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { Asset } from "src/hydraulic-model";

export const SymbolizationDialog = () => {
  return (
    <>
      <DialogHeader title="Symbolization" titleIcon={ColorWheelIcon} />
      <SymbolizationEditor />
    </>
  );
};

const regenerateAtom = atom<boolean>(false);

export function SymbolizationEditor() {
  const [{ nodes }, setAnalysis] = useAtom(analysisAtom);
  const [regenerate, setRegenerate] = useAtom(regenerateAtom);

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
        <PanelDetails
          title="Configuration"
          accessory={
            regenerate === false ? (
              <Button
                size="xs"
                onClick={() => {
                  setRegenerate(true);
                }}
              >
                <ResetIcon />
                Regenerate
              </Button>
            ) : null
          }
        >
          <div className="text-sm">
            <RampWizard
              symbolization={nodes.rangeColorMapping.symbolization}
              onChange={handleChange}
            />
          </div>
        </PanelDetails>
      </div>
    </div>
  );
}

const DEFAULT_CLASSES = 7;

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

  const [regenerate, setRegenerate] = useAtom(regenerateAtom);
  const [formError, setFormError] = useState<string | null>(null);

  return regenerate ? (
    <Formik<RampValues>
      onSubmit={(values) => {
        const ramp = COLORBREWER_ALL.find(
          (ramp) => ramp.name === values.rampName,
        )!;
        const dataValues = options.get(values.property)!;
        const colors = ramp.colors[values.classes]!;

        function getStopsLinear({ colors }: { colors: string[] }) {
          const [min, max] = d3.extent(dataValues) as [number, number];
          return colors.map((output, i, arr) => {
            return {
              input: +lerp(min, max, i / (arr.length - 1)).toFixed(4),
              output,
            };
          });
        }

        function getStopsQuantile({ colors }: { colors: string[] }) {
          const stops = colors
            .map((output, i, arr) => {
              return {
                input: d3.quantile(dataValues, i / (arr.length - 1)) || 0,
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
        }

        const newSymbolization: ISymbolizationRamp = {
          type: "ramp",
          simplestyle: values.simplestyle,
          property: values.property,
          interpolate: values.interpolate,
          rampName: values.rampName,
          defaultColor: values.defaultColor,
          defaultOpacity: values.defaultOpacity,
          stops:
            values.breaks === "linear"
              ? getStopsLinear({ colors })
              : getStopsQuantile({ colors }),
        };

        onChange(newSymbolization);
        setRegenerate(false);
      }}
      initialValues={{
        property: symbolization?.type === "ramp" ? symbolization.property : "",
        defaultColor: colors.indigo800,
        defaultOpacity: symbolization.defaultOpacity,
        interpolate:
          symbolization?.type === "ramp" ? symbolization.interpolate : "step",
        simplestyle:
          symbolization?.type === "ramp" ? symbolization.simplestyle : true,
        breaks: "linear",
        rampName: "RdPu",
        classes: DEFAULT_CLASSES,
      }}
    >
      <Form>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <label className="block">
              <div className="">
                <StyledLabelSpan>Input property</StyledLabelSpan>
              </div>
              <Field
                as="select"
                name="property"
                required
                className={styledSelect({ size: "sm" }) + " w-full"}
              >
                <option value={""}>Select…</option>
                {Array.from(options.keys(), (cat) => {
                  return (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  );
                })}
              </Field>
            </label>
            <label>
              <StyledLabelSpan>Class breaks</StyledLabelSpan>
              <Field
                as="select"
                name="breaks"
                required
                className={styledSelect({ size: "sm" }) + " w-full"}
              >
                <option value="linear">Linear</option>
                <option value="quantile">Quantile</option>
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
                              <StyledLabelSpan>Classes</StyledLabelSpan>
                              <Field
                                as="select"
                                name="classes"
                                required
                                className={
                                  styledSelect({ size: "sm" }) + " w-full"
                                }
                              >
                                {d3.range(3, 8).map((count) => {
                                  return (
                                    <option key={count} value={String(count)}>
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
          <div className="relative pt-2">
            <Button type="submit" variant="primary">
              Generate
            </Button>
          </div>
        </div>
      </Form>
    </Formik>
  ) : (
    <div>
      <Formik<ISymbolizationRamp>
        onSubmit={async (values) => {
          try {
            Symbolization.parse(values);
          } catch (e) {
            setFormError((e as Error).message);
            return;
          }
          setFormError(null);
          try {
            await Promise.resolve(onChange(values)).catch(() => {
              toast.error("Failed to generate ramp");
            });
          } catch (e) {
            captureError(e as Error);
          }
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
        initialValues={symbolization}
      >
        {({ values }) => {
          return (
            <Form className="space-y-4">
              {formError && <InlineError>{formError}</InlineError>}
              <FieldArray name="stops">
                {(arrayHelpers: ArrayHelpers) => (
                  <div
                    className="w-full grid gap-2 items-center dark:text-white"
                    style={{
                      gridTemplateColumns: "1fr 1fr min-content",
                    }}
                  >
                    <div className="text-left font-normal">Value</div>
                    <div className="text-left font-normal col-span-2">
                      Output
                    </div>
                    {values.stops.map((_stop, i) => {
                      return (
                        <Fragment key={i}>
                          <div>
                            <Field
                              name={`stops.${i}.input`}
                              type="number"
                              className={inputClass({
                                _size: "sm",
                              })}
                            />
                          </div>
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
                          {values.stops.length > 1 ? (
                            <div>
                              <Button
                                variant="quiet"
                                aria-label="Delete stop"
                                onClick={() => {
                                  arrayHelpers.remove(i);
                                }}
                              >
                                <TrashIcon className="opacity-60" />
                              </Button>
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                    <div className="col-span-3">
                      <Button
                        type="button"
                        onClick={() => {
                          const lastValue = last(values.stops);
                          arrayHelpers.push({
                            input: (lastValue?.input || 0) + 1,
                            output: "#0fffff",
                          });
                        }}
                      >
                        <PlusIcon /> Add stop
                      </Button>
                    </div>
                  </div>
                )}
              </FieldArray>
              <ErrorMessage name={`stops`} component={InlineError} />
              <label className="block space-y-1">
                <InterpolateOption />
              </label>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export function getNumericPropertyMap(assets: Asset[]) {
  const numericPropertyMap = new Map<string, number[]>();
  for (const asset of assets) {
    for (const [key, value] of Object.entries(asset.feature.properties || {})) {
      if (typeof value === "number") {
        const oldValue = numericPropertyMap.get(key);
        if (oldValue) {
          oldValue.push(value);
        } else {
          numericPropertyMap.set(key, [value]);
        }
      }
    }
  }
  for (const val of numericPropertyMap.values()) {
    val.sort();
  }
  return numericPropertyMap;
}
