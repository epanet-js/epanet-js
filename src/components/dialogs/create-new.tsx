import {
  DialogContainer,
  DialogHeader,
  useDialogState,
  BaseDialog,
  SimpleDialogActionsNew,
} from "../dialog";
import { Form, Formik } from "formik";
import mapboxgl from "mapbox-gl";
import { SimpleDialogActions } from "src/components/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  Presets,
  Quantities,
  presets,
  supportedPressureUnits,
  getDefaultPressureUnit,
  withPressureUnit,
} from "src/model-metadata/quantities-spec";
import type { Unit } from "src/quantity";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { ModelMetadata } from "src/model-metadata";
import { createProjectionMapper } from "src/projections";
import type { Projection } from "src/projections";
import {
  HeadlossFormula,
  headlossFormulas,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { usePersistence } from "src/lib/persistence";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { useTranslate } from "src/hooks/use-translate";
import { Selector } from "../form/selector";
import {
  SearchableSelector,
  type SearchableSelectorOption,
} from "../form/searchable-selector";
import { useAtomValue, useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/file-system";
import {
  gridHiddenAtom,
  gridPreviewAtom,
  isUnprojectedAtom,
} from "src/state/map-projection";
import { headlossFormulasFullNames } from "src/hydraulic-model/asset-types/pipe";
import { useUserTracking } from "src/infra/user-tracking";
import { MapContext } from "src/map/map-context";
import { MapEngine } from "src/map/map-engine";
import { useContext, useRef, useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { env } from "src/lib/env-client";

import NetworkUnprojectedIllustration from "./network-projection/network-unprojected";
import NetworkProjectedIllustration from "./network-projection/network-projected";
import clsx from "clsx";

type LocationData = {
  name: string;
  coordinates: [number, number];
  bbox: [number, number, number, number];
};

type MapboxFeature = {
  bbox: [number, number, number, number];
  center: [number, number];
  place_name: string;
  text: string;
  [key: string]: any;
};

type MapboxResponse = {
  features?: MapboxFeature[];
  [key: string]: any;
};

type LocationOption = SearchableSelectorOption & {
  data: LocationData;
};

type SubmitProps = {
  unitsSpec: keyof Presets;
  headlossFormula: HeadlossFormula;
  pressureUnit?: Unit;
  location?: LocationData;
  projection: Projection;
};

export const CreateNew = () => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const isEpanet23On = useFeatureFlag("FLAG_EPANET23");
  const translate = useTranslate();
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const setFileInfo = useSetAtom(fileInfoAtom);
  const userTracking = useUserTracking();
  const map = useContext(MapContext);

  const setGridPreview = useSetAtom(gridPreviewAtom);
  const setGridHidden = useSetAtom(gridHiddenAtom);
  const isCurrentProjectUnprojected = useAtomValue(isUnprojectedAtom);
  const { closeDialog } = useDialogState();

  const originalMapStateRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (map && !originalMapStateRef.current) {
    originalMapStateRef.current = map.getBounds();
    if (isCurrentProjectUnprojected) {
      setGridHidden(true);
      map.map.jumpTo({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM });
    }
  }

  const handleCancel = useCallback(() => {
    setGridPreview(false);
    setGridHidden(false);
    if (map && originalMapStateRef.current) {
      map.setBounds(originalMapStateRef.current, {
        animate: false,
      });
    }
    closeDialog();
  }, [map, setGridPreview, setGridHidden, closeDialog]);

  const handleSubmit = useCallback(
    ({
      unitsSpec,
      headlossFormula,
      pressureUnit,
      location,
      projection,
    }: SubmitProps) => {
      const spec = pressureUnit
        ? withPressureUnit(presets[unitsSpec], pressureUnit)
        : presets[unitsSpec];
      const quantities = new Quantities(spec);
      const modelMetadata: ModelMetadata = {
        quantities,
        units: spec.units,
        projectionMapper: buildNewProjectProjectionMapper(projection),
      };
      const hydraulicModel = initializeHydraulicModel({
        defaults: quantities.defaults,
        headlossFormula,
      });
      const factories = initializeModelFactories();
      setGridPreview(false);
      setGridHidden(false);
      transactImport(
        hydraulicModel,
        factories,
        modelMetadata,
        "Untitled",
        defaultSimulationSettings,
        { autoElevations: projection !== "xy-grid" },
      );
      if (map) {
        centerMapForNewProject(map, projection, location);
      }
      userTracking.capture({
        name: "newModel.completed",
        units: unitsSpec,
        headlossFormula,
        location: location?.name || "",
        projection,
      });
      setFileInfo(null);
      closeDialog();
    },
    [
      transactImport,
      userTracking,
      setFileInfo,
      map,
      setGridPreview,
      setGridHidden,
      closeDialog,
    ],
  );

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("newProject")}
        size="sm"
        isOpen={true}
        onClose={handleCancel}
        footer={
          <SimpleDialogActionsNew
            action={translate("create")}
            onAction={() => formRef.current?.requestSubmit()}
            onClose={handleCancel}
          />
        }
      >
        <div className="p-4">
          <Formik
            onSubmit={handleSubmit}
            initialValues={
              {
                unitsSpec: "LPS",
                headlossFormula: "H-W",
                location: undefined,
                projection: "wgs84",
              } as SubmitProps
            }
          >
            {({ values, setFieldValue }) => (
              <Form ref={formRef}>
                <ProjectionSelector
                  selected={values.projection}
                  onChange={(projection) => {
                    void setFieldValue("projection", projection);
                    if (projection === "xy-grid") {
                      setGridHidden(false);
                      setGridPreview(true);
                      if (map) {
                        map.map.jumpTo({
                          center: XY_GRID_CENTER,
                          zoom: XY_GRID_ZOOM,
                        });
                      }
                    } else {
                      setGridPreview(false);
                      if (isCurrentProjectUnprojected) {
                        setGridHidden(true);
                      }
                      if (map) {
                        if (values.location?.bbox) {
                          map.map.fitBounds(values.location.bbox, {
                            padding: 50,
                            animate: false,
                          });
                        } else if (originalMapStateRef.current) {
                          map.setBounds(originalMapStateRef.current, {
                            animate: false,
                          });
                        }
                      }
                    }
                  }}
                />

                <LocationSearchSelector
                  selected={values.location}
                  onChange={(location) => setFieldValue("location", location)}
                  disabled={values.projection === "xy-grid"}
                />

                <hr className="my-2" />

                <UnitsSystemSelector
                  selected={values.unitsSpec}
                  onChange={(specId) => {
                    void setFieldValue("unitsSpec", specId);
                    void setFieldValue(
                      "pressureUnit",
                      getDefaultPressureUnit(specId),
                    );
                  }}
                />
                {isEpanet23On && (
                  <PressureUnitSelector
                    selected={
                      values.pressureUnit ??
                      getDefaultPressureUnit(values.unitsSpec)
                    }
                    onChange={(pu) => setFieldValue("pressureUnit", pu)}
                  />
                )}
                <HeadlossFormulaSelector
                  selected={values.headlossFormula}
                  onChange={(headlossFormula) =>
                    setFieldValue("headlossFormula", headlossFormula)
                  }
                />
              </Form>
            )}
          </Formik>
        </div>
      </BaseDialog>
    );
  }

  return (
    <DialogContainer onClose={handleCancel}>
      <DialogHeader title={translate("newProject")} />
      <Formik
        onSubmit={handleSubmit}
        initialValues={
          {
            unitsSpec: "LPS",
            headlossFormula: "H-W",
            location: undefined,
            projection: "wgs84",
          } as SubmitProps
        }
      >
        {({ values, setFieldValue }) => (
          <Form>
            <ProjectionSelector
              selected={values.projection}
              onChange={(projection) => {
                void setFieldValue("projection", projection);
                if (projection === "xy-grid") {
                  setGridHidden(false);
                  setGridPreview(true);
                  if (map) {
                    map.map.jumpTo({
                      center: XY_GRID_CENTER,
                      zoom: XY_GRID_ZOOM,
                    });
                  }
                } else {
                  setGridPreview(false);
                  if (isCurrentProjectUnprojected) {
                    setGridHidden(true);
                  }
                  if (map) {
                    if (values.location?.bbox) {
                      map.map.fitBounds(values.location.bbox, {
                        padding: 50,
                        animate: false,
                      });
                    } else if (originalMapStateRef.current) {
                      map.setBounds(originalMapStateRef.current, {
                        animate: false,
                      });
                    }
                  }
                }
              }}
            />

            <LocationSearchSelector
              selected={values.location}
              onChange={(location) => setFieldValue("location", location)}
              disabled={values.projection === "xy-grid"}
            />

            <hr className="my-2" />

            <UnitsSystemSelector
              selected={values.unitsSpec}
              onChange={(specId) => {
                void setFieldValue("unitsSpec", specId);
                void setFieldValue(
                  "pressureUnit",
                  getDefaultPressureUnit(specId),
                );
              }}
            />
            {isEpanet23On && (
              <PressureUnitSelector
                selected={
                  values.pressureUnit ??
                  getDefaultPressureUnit(values.unitsSpec)
                }
                onChange={(pu) => setFieldValue("pressureUnit", pu)}
              />
            )}
            <HeadlossFormulaSelector
              selected={values.headlossFormula}
              onChange={(headlossFormula) =>
                setFieldValue("headlossFormula", headlossFormula)
              }
            />
            <SimpleDialogActions
              onClose={handleCancel}
              action={translate("create")}
            />
          </Form>
        )}
      </Formik>
    </DialogContainer>
  );
};

const LocationSearchSelector = ({
  selected,
  onChange,
  disabled = false,
}: {
  selected?: LocationData;
  onChange: (location: LocationData) => void;
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const map = useContext(MapContext);

  const searchLocations = useCallback(
    async (query: string): Promise<LocationOption[]> => {
      if (!query.trim() || query.length < 2) {
        return [];
      }

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query,
          )}.json?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,locality&limit=5`,
        );

        if (response.ok) {
          const data: MapboxResponse = await response.json();
          const features = data.features || [];

          return features
            .filter(isValidMapboxFeature)
            .map((feature: MapboxFeature) => ({
              id: feature.place_name || feature.text,
              label: feature.place_name || feature.text,
              data: {
                name: feature.place_name || feature.text,
                coordinates: feature.center as [number, number],
                bbox: feature.bbox as [number, number, number, number],
              },
            }));
        }
      } catch (error) {
        captureError(error as Error);
      }
      return [];
    },
    [],
  );

  const handleLocationChange = useCallback(
    (option: LocationOption) => {
      const locationData = option.data;

      if (map && locationData.bbox && locationData.coordinates) {
        map.map.fitBounds(locationData.bbox, {
          padding: 50,
          animate: false,
        });
      }
    },
    [map],
  );

  return (
    <SearchableSelector
      selected={
        selected
          ? {
              id: selected.name,
              label: selected.name,
              data: selected,
            }
          : undefined
      }
      onChange={(option) => {
        onChange(option.data);
        void handleLocationChange(option);
      }}
      onSearch={searchLocations}
      placeholder={translate("searchLocation")}
      label={translate("location")}
      disabled={disabled}
    />
  );
};

const isValidMapboxFeature = (feature: unknown): feature is MapboxFeature => {
  if (!feature || typeof feature !== "object") {
    return false;
  }

  const obj = feature as Record<string, unknown>;

  return (
    "center" in obj &&
    "bbox" in obj &&
    Array.isArray(obj.center) &&
    Array.isArray(obj.bbox) &&
    ("place_name" in obj || "text" in obj) &&
    (typeof obj.place_name === "string" || typeof obj.text === "string")
  );
};

const UnitsSystemSelector = ({
  selected,
  onChange,
}: {
  selected: keyof Presets;
  onChange: (specId: keyof Presets) => void;
}) => {
  const translate = useTranslate();
  const options = Object.entries(presets).map(([presetId, spec]) => ({
    label: `${spec.name}: ${translate(spec.descriptionKey)}`,
    value: presetId as keyof Presets,
  }));

  return (
    <label className="block pt-2 pb-2 space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        {translate("unitsSystem")}
      </div>

      <Selector
        options={options}
        tabIndex={0}
        selected={selected}
        onChange={onChange}
        ariaLabel={translate("unitsSystem")}
      />
    </label>
  );
};

const HeadlossFormulaSelector = ({
  selected,
  onChange,
}: {
  selected: HeadlossFormula;
  onChange: (headlossFormula: HeadlossFormula) => void;
}) => {
  const translate = useTranslate();
  const options = Object.values(headlossFormulas).map((headlossFormula, i) => ({
    label: `${headlossFormulasFullNames[i]} (${headlossFormula})`,
    value: headlossFormula,
  }));

  return (
    <label className="block pt-2 pb-2 space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        {translate("headlossFormula")}
      </div>

      <Selector
        options={options}
        tabIndex={0}
        selected={selected}
        onChange={onChange}
        ariaLabel={translate("headlossFormula")}
      />
    </label>
  );
};

const PressureUnitSelector = ({
  selected,
  onChange,
}: {
  selected: Unit;
  onChange: (pressureUnit: Unit) => void;
}) => {
  const translateUnit = useTranslateUnit();
  const options = supportedPressureUnits.map((pu) => ({
    label: translateUnit(pu),
    value: pu as string,
  }));

  return (
    <label className="block pt-2 pb-2 space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Pressure Units
      </div>

      <Selector
        options={options}
        tabIndex={0}
        selected={selected as string}
        onChange={(value) => onChange(value as Unit)}
        ariaLabel="Pressure Units"
      />
    </label>
  );
};

const projectionCardBase =
  "flex flex-col text-left cursor-pointer rounded-lg border bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors overflow-hidden";
const projectionCardUnselected = "border-gray-200 dark:border-gray-700";
const projectionCardSelected = "border-purple-500 ring-1 ring-purple-500";

const ProjectionSelector = ({
  selected,
  onChange,
}: {
  selected: Projection;
  onChange: (projection: Projection) => void;
}) => {
  const translate = useTranslate();

  return (
    <div className="grid grid-cols-2 gap-3 pb-3">
      <button
        type="button"
        onClick={() => onChange("wgs84")}
        className={clsx(
          projectionCardBase,
          selected === "wgs84"
            ? projectionCardSelected
            : projectionCardUnselected,
        )}
      >
        <div className="w-full border-b border-gray-200">
          <NetworkProjectedIllustration />
        </div>
        <div className="p-3 flex-grow">
          <p className="font-bold text-gray-900 dark:text-gray-100">
            {translate("inpProjectionChoice.projectedTitle")}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {translate("inpProjectionChoice.projectedDescription")}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange("xy-grid")}
        className={clsx(
          projectionCardBase,
          selected === "xy-grid"
            ? projectionCardSelected
            : projectionCardUnselected,
        )}
      >
        <div className="w-full border-b border-gray-200">
          <NetworkUnprojectedIllustration />
        </div>
        <div className="p-3 flex-grow">
          <p className="font-bold text-gray-900 dark:text-gray-100">
            {translate("inpProjectionChoice.nonProjectedTitle")}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {translate("inpProjectionChoice.nonProjectedDescription")}
          </p>
        </div>
      </button>
    </div>
  );
};

const XY_GRID_CENTER: [number, number] = [0, 0];
const XY_GRID_ZOOM = 15;
const DEFAULT_MAP_CENTER: [number, number] = [-4.3800042, 55.914314];
const DEFAULT_MAP_ZOOM = 15.5;

const buildNewProjectProjectionMapper = (projection: Projection) =>
  projection === "xy-grid"
    ? createProjectionMapper({ type: "xy-grid", centroid: XY_GRID_CENTER })
    : createProjectionMapper({ type: "wgs84" });

const centerMapForNewProject = (
  map: MapEngine,
  projection: Projection,
  location?: LocationData,
) => {
  if (projection === "xy-grid") {
    map.map.jumpTo({ center: XY_GRID_CENTER, zoom: XY_GRID_ZOOM });
  } else if (!location) {
    map.map.jumpTo({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM });
  }
};
