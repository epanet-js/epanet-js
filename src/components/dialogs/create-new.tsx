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
import { useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/jotai";
import { headlossFormulasFullNames } from "src/hydraulic-model/asset-types/pipe";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { MapContext } from "src/map/map-context";
import { useContext, useRef, useState } from "react";
import { env } from "src/lib/env-client";

type LocationData = {
  name: string;
  coordinates: [number, number];
  bbox: [number, number, number, number];
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

  const handleSumbit = ({
    unitsSpec,
    headlossFormula,
    location,
  }: SubmitProps) => {
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
  };

  const handleCancel = () => {
    if (map && originalMapStateRef.current) {
      map.map.fitBounds(originalMapStateRef.current.bounds, {
        animate: false,
      });
    }
    onClose();
  };

  return (
    <>
      <DialogHeader title={translate("newProject")} titleIcon={FileIcon} />
      <Formik
        onSubmit={handleSumbit}
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
            <LocationSearchSelector
              selected={values.location}
              onChange={(location) => setFieldValue("location", location)}
              map={map}
            />
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
  onChange,
  map,
}: {
  selected?: LocationData;
  onChange: (location: LocationData) => void;
  map: any;
}) => {
  const translate = useTranslate();
  const isLocationSearchOn = useFeatureFlag("FLAG_NEW_PROJECT_LOCATION");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=place,locality&limit=5`,
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.features || []);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(true);
    searchLocations(value);
  };

  const handleSuggestionClick = (suggestion: any) => {
    const bbox = suggestion.bbox;
    const coordinates = suggestion.center;

    if (map && bbox && coordinates) {
      map.map.fitBounds(bbox, {
        padding: 50,
        animate: false,
      });

      onChange({
        name: suggestion.place_name || suggestion.text,
        coordinates: coordinates,
        bbox: bbox,
      });
    }

    setSearchTerm(suggestion.place_name || suggestion.text);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleInputBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  if (!isLocationSearchOn) return null;

  return (
    <label className="block pt-2 space-y-2 pb-3">
      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        {translate("location")}
      </div>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setShowSuggestions(true)}
          placeholder={translate("searchLocation")}
          className="flex items-center gap-x-2 text-gray-700 focus:justify-between hover:border hover:rounded-sm hover:border-gray-200 hover:justify-between w-full min-w-[90px] border rounded-sm border-gray-200 justify-between px-2 py-2 text-sm pl-min-2 focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
        />
        {isLoading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
          </div>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border text-sm rounded-md shadow-md max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center justify-between gap-4 px-2 py-2 focus:bg-purple-300/40 cursor-pointer w-full text-left text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span>{suggestion.place_name || suggestion.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
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
