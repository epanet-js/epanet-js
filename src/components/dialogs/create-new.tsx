import { FileIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import {
  Presets,
  Quantities,
  presets,
} from "src/model-metadata/quantities-spec";
import {
  HeadlossFormula,
  headlossFormulas,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import { usePersistence } from "src/lib/persistence/context";
import { useTranslate } from "src/hooks/use-translate";
import { Selector } from "../form/selector";
import {
  SearchableSelector,
  type SearchableSelectorOption,
} from "../form/searchable-selector";
import { useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/jotai";
import { headlossFormulasFullNames } from "src/hydraulic-model/asset-types/pipe";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { MapContext } from "src/map/map-context";
import { useContext, useRef, useCallback } from "react";
import { captureError } from "src/infra/error-tracking";
import { env } from "src/lib/env-client";

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
  location?: LocationData;
};

export const CreateNew = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const setFileInfo = useSetAtom(fileInfoAtom);
  const userTracking = useUserTracking();
  const map = useContext(MapContext);
  const isLocationSearchOn = useFeatureFlag("FLAG_NEW_PROJECT_LOCATION");

  const originalMapStateRef = useRef<{
    center: [number, number];
    zoom: number;
    bounds: [number, number, number, number];
  } | null>(null);

  if (map && isLocationSearchOn && !originalMapStateRef.current) {
    const center = map.map.getCenter().toArray();
    const bounds = map.map.getBounds().toArray();
    originalMapStateRef.current = {
      center: [center[0], center[1]] as [number, number],
      zoom: map.map.getZoom(),
      bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]] as [
        number,
        number,
        number,
        number,
      ],
    };
  }

  const handleSubmit = useCallback(
    ({ unitsSpec, headlossFormula, location }: SubmitProps) => {
      const quantities = new Quantities(presets[unitsSpec]);
      const modelMetadata = { quantities };
      const hydraulicModel = initializeHydraulicModel({
        units: quantities.units,
        defaults: quantities.defaults,
        headlossFormula,
      });
      transactImport(hydraulicModel, modelMetadata, "Untitled");
      userTracking.capture({
        name: "newModel.completed",
        units: unitsSpec,
        headlossFormula,
        location: location?.name || "",
      });
      setFileInfo(null);
      onClose();
    },
    [transactImport, userTracking, setFileInfo, onClose],
  );

  const handleCancel = useCallback(() => {
    if (map && originalMapStateRef.current) {
      map.map.fitBounds(originalMapStateRef.current.bounds, {
        animate: false,
      });
    }
    onClose();
  }, [map, onClose]);

  return (
    <>
      <DialogHeader title={translate("newProject")} titleIcon={FileIcon} />
      <Formik
        onSubmit={handleSubmit}
        initialValues={
          {
            unitsSpec: "LPS",
            headlossFormula: "H-W",
            location: undefined,
          } as SubmitProps
        }
      >
        {({ values, setFieldValue }) => (
          <Form>
            {isLocationSearchOn && (
              <LocationSearchSelector
                selected={values.location}
                onChange={(location) => setFieldValue("location", location)}
              />
            )}
            <UnitsSystemSelector
              selected={values.unitsSpec}
              onChange={(specId) => setFieldValue("unitsSpec", specId)}
            />
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
    </>
  );
};

const LocationSearchSelector = ({
  selected,
  onChange,
}: {
  selected?: LocationData;
  onChange: (location: LocationData) => void;
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
    <label className="block pt-2 space-y-2 pb-3">
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
    <label className="block pt-2 space-y-2">
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
