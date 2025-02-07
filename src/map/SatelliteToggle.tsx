import { useAtomValue } from "jotai";
import { layerConfigAtom } from "src/state/jotai";
import { useLayerConfigState } from "./layer-config";
import LAYERS from "src/lib/default_layers";
import { newFeatureId } from "src/lib/id";
import { mapboxStaticURL } from "src/lib/mapbox_static_url";

export const SatelliteToggle = () => {
  const layerConfigs = useAtomValue(layerConfigAtom);
  const { applyChanges } = useLayerConfigState();
  if (layerConfigs.size !== 1) return null;

  const currentBaseMap = [...layerConfigs.values()][0];
  const handleToggle = () => {
    const newBaseMap =
      currentBaseMap.name === LAYERS.MONOCHROME.name
        ? LAYERS.SATELLITE
        : LAYERS.MONOCHROME;
    applyChanges({
      deleteLayerConfigs: [currentBaseMap.id],
      putLayerConfigs: [
        {
          ...newBaseMap,
          visibility: true,
          tms: false,
          opacity: newBaseMap.opacity,
          at: currentBaseMap.at,
          id: newFeatureId(),
          labelVisibility: true,
          poiVisibility: true,
        },
      ],
    });
  };
  return (
    <div
      className="absolute bottom-[48px] left-3 w-[92px] h-[92px] mb-2 bg-white rounded border border-white border-2 shadow-md cursor-pointer"
      style={{
        backgroundSize: "cover",
        backgroundImage: `url(${mapboxStaticURL(currentBaseMap)})`,
      }}
      onClick={handleToggle}
    ></div>
  );
};
