import { useAtomValue } from "jotai";
import { useToggleSatellite } from "src/commands/toggle-satellite";
import { mapboxStaticURL } from "src/lib/mapbox_static_url";
import { layerConfigAtom } from "src/state/jotai";

export const SatelliteToggle = () => {
  const toggleSatellite = useToggleSatellite();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const currentBaseMap = [...layerConfigs.values()][0];

  if (layerConfigs.size !== 1) return null;

  return (
    <div
      className="absolute bottom-[48px] left-3 w-[92px] h-[92px] mb-2 bg-white rounded border border-white border-2 shadow-md cursor-pointer"
      style={{
        backgroundSize: "cover",
        backgroundImage: `url(${mapboxStaticURL(currentBaseMap)})`,
      }}
      onClick={() => toggleSatellite()}
    ></div>
  );
};
