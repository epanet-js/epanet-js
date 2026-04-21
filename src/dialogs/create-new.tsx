import {
  useDialogState,
  BaseDialog,
  SimpleDialogActions,
} from "../components/dialog";
import { Form, Formik } from "formik";
import mapboxgl from "mapbox-gl";

import {
  Presets,
  presets,
  supportedPressureUnits,
  getDefaultPressureUnit,
  withPressureUnit,
  withHeadlossDefaults,
  flowUnitTranslationKeys,
  pressureUnitTranslationKeys,
} from "src/lib/project-settings/quantities-spec";
import type { Unit } from "src/quantity";
import { ProjectSettings } from "src/lib/project-settings";
import { type Projection, WGS84 } from "src/lib/projections";
import {
  HeadlossFormula,
  headlossFormulas,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { useTranslate } from "src/hooks/use-translate";
import { useStartNewProject } from "src/hooks/persistence/use-start-new-project";
import { Selector } from "../components/form/selector";

import { useAtomValue, useSetAtom } from "jotai";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
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

import NetworkUnprojectedIllustration from "./network-projection/network-unprojected";
import NetworkProjectedIllustration from "./network-projection/network-projected";
import clsx from "clsx";
import { InlineField } from "../components/form/fields";

import {
  LocationSearch,
  type LocationData,
} from "../components/form/location-search";

type ProjectionOption = { id: string; name: string };
const XY_GRID_OPTION: ProjectionOption = { id: "xy-grid", name: "XY Grid" };

type SubmitProps = {
  unitsSpec: keyof Presets;
  headlossFormula: HeadlossFormula;
  pressureUnit?: Unit;
  location?: LocationData;
  projection: ProjectionOption;
};

export const CreateNew = () => {
  const translate = useTranslate();
  const { startNewProject } = useStartNewProject();
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
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
    async ({
      unitsSpec,
      headlossFormula,
      pressureUnit,
      location,
      projection,
    }: SubmitProps) => {
      const spec = pressureUnit
        ? withPressureUnit(presets[unitsSpec], pressureUnit)
        : presets[unitsSpec];
      const defaults = withHeadlossDefaults(spec.defaults, headlossFormula);
      const projectSettings: ProjectSettings = {
        units: spec.units,
        defaults,
        headlossFormula,
        formatting: { decimals: spec.decimals, defaultDecimals: 3 },
        projection: buildNewProjection(projection),
      };
      const idGenerator = new ConsecutiveIdsGenerator();
      const hydraulicModel = initializeHydraulicModel({
        idGenerator,
      });
      const factories = initializeModelFactories({
        idGenerator,
        labelManager: new LabelManager(),
        defaults,
      });
      setGridPreview(false);
      setGridHidden(false);
      await startNewProject({
        hydraulicModel,
        factories,
        projectSettings,
        simulationSettings: defaultSimulationSettings,
        autoElevations: projection.id !== "xy-grid",
      });
      if (map) {
        centerMapForNewProject(map, projection, location);
      }
      userTracking.capture({
        name: "newModel.completed",
        units: unitsSpec,
        headlossFormula,
        location: location?.name || "",
        projection: projection.id,
      });
      setInpFileInfo(null);
      setProjectFileInfo(null);
      closeDialog();
    },
    [
      closeDialog,
      startNewProject,
      map,
      setInpFileInfo,
      setProjectFileInfo,
      setGridPreview,
      setGridHidden,
      userTracking,
    ],
  );

  return (
    <BaseDialog
      title={translate("newProject")}
      size="sm"
      isOpen={true}
      onClose={handleCancel}
      footer={
        <SimpleDialogActions
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
              projection: WGS84,
            } as SubmitProps
          }
        >
          {({ values, setFieldValue }) => (
            <Form ref={formRef}>
              <div className="space-y-3">
                <ProjectionSelector
                  selected={values.projection}
                  onChange={(projection) => {
                    void setFieldValue("projection", projection);
                    if (projection.id === "xy-grid") {
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
                  disabled={values.projection.id === "xy-grid"}
                />
              </div>
              <hr className="my-4" />
              <div className="space-y-2">
                <FlowUnitsSelector
                  selected={values.unitsSpec}
                  onChange={(specId) => {
                    void setFieldValue("unitsSpec", specId);
                    void setFieldValue(
                      "pressureUnit",
                      getDefaultPressureUnit(specId),
                    );
                  }}
                />
                <PressureUnitSelector
                  selected={
                    values.pressureUnit ??
                    getDefaultPressureUnit(values.unitsSpec)
                  }
                  onChange={(pu) => setFieldValue("pressureUnit", pu)}
                />
                <HeadlossFormulaSelector
                  selected={values.headlossFormula}
                  onChange={(headlossFormula) =>
                    setFieldValue("headlossFormula", headlossFormula)
                  }
                />
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </BaseDialog>
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

  const handleChange = useCallback(
    (location: LocationData) => {
      onChange(location);
      if (map && location.bbox && location.coordinates) {
        map.map.fitBounds(location.bbox, {
          padding: 50,
          animate: false,
        });
      }
    },
    [map, onChange],
  );

  return (
    <InlineField
      name={translate("location")}
      layout="fixed-label"
      labelSize="md"
    >
      <LocationSearch
        selected={selected}
        onChange={handleChange}
        placeholder={translate("searchLocation")}
        disabled={disabled}
      />
    </InlineField>
  );
};

const FlowUnitsSelector = ({
  selected,
  onChange,
}: {
  selected: keyof Presets;
  onChange: (specId: keyof Presets) => void;
}) => {
  const translate = useTranslate();
  const options = Object.entries(presets).map(([presetId]) => ({
    label: translate(flowUnitTranslationKeys[presetId as keyof Presets]),
    value: presetId as keyof Presets,
  }));

  return (
    <InlineField
      name={translate("simulationSettings.flowUnits")}
      layout="fixed-label"
      labelSize="md"
    >
      <Selector
        options={options}
        tabIndex={0}
        selected={selected}
        onChange={onChange}
        ariaLabel={translate("simulationSettings.flowUnits")}
      />
    </InlineField>
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
    <InlineField
      name={translate("headlossFormula")}
      layout="fixed-label"
      labelSize="md"
    >
      <Selector
        options={options}
        tabIndex={0}
        selected={selected}
        onChange={onChange}
        ariaLabel={translate("headlossFormula")}
      />
    </InlineField>
  );
};

const PressureUnitSelector = ({
  selected,
  onChange,
}: {
  selected: Unit;
  onChange: (pressureUnit: Unit) => void;
}) => {
  const translate = useTranslate();
  const options = supportedPressureUnits.map((pu) => ({
    label: translate(
      pressureUnitTranslationKeys[pu as string] ?? (pu as string),
    ),
    value: pu as string,
  }));

  return (
    <InlineField
      name={translate("simulationSettings.pressureUnits")}
      layout="fixed-label"
      labelSize="md"
    >
      <Selector
        options={options}
        tabIndex={0}
        selected={selected as string}
        onChange={(value) => onChange(value as Unit)}
        ariaLabel={translate("simulationSettings.pressureUnits")}
      />
    </InlineField>
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
  selected: ProjectionOption;
  onChange: (projection: ProjectionOption) => void;
}) => {
  const translate = useTranslate();

  return (
    <div>
      <div className="text-sm text-gray-500 mb-2">
        {translate("projection")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange(WGS84)}
          className={clsx(
            projectionCardBase,
            selected.id === "wgs84"
              ? projectionCardSelected
              : projectionCardUnselected,
          )}
        >
          <div className="w-full border-b border-gray-200 h-28 overflow-hidden">
            <NetworkProjectedIllustration preserveAspectRatio="xMidYMid slice" />
          </div>
          <div className="flex-grow p-2">
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {translate("inpProjectionChoice.projectedTitle")}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange(XY_GRID_OPTION)}
          className={clsx(
            projectionCardBase,
            selected.id === "xy-grid"
              ? projectionCardSelected
              : projectionCardUnselected,
          )}
        >
          <div className="w-full border-b border-gray-200 h-28 overflow-hidden">
            <NetworkUnprojectedIllustration preserveAspectRatio="xMidYMid slice" />
          </div>
          <div className="flex-grow p-2">
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {translate("inpProjectionChoice.nonProjectedTitle")}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

const XY_GRID_CENTER: [number, number] = [0, 0];
const XY_GRID_ZOOM = 15;
const DEFAULT_MAP_CENTER: [number, number] = [-4.3800042, 55.914314];
const DEFAULT_MAP_ZOOM = 15.5;

const buildNewProjection = (option: ProjectionOption): Projection =>
  option.id === "xy-grid"
    ? {
        type: "xy-grid",
        id: "xy-grid",
        name: "XY Grid",
        centroid: XY_GRID_CENTER,
      }
    : WGS84;

const centerMapForNewProject = (
  map: MapEngine,
  projection: ProjectionOption,
  location?: LocationData,
) => {
  if (projection.id === "xy-grid") {
    map.map.jumpTo({ center: XY_GRID_CENTER, zoom: XY_GRID_ZOOM });
  } else if (!location) {
    map.map.jumpTo({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM });
  }
};
