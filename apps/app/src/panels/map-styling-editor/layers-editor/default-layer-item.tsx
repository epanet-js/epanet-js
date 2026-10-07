import { Tooltip } from "@epanet-js/ui-kit";
import { menuItemLike } from "src/components/elements";
import { Thumbnail } from "./thumbnail";
import { LayerConfigTemplate } from "src/map/basemaps";

type T = LayerConfigTemplate;

/**
 * Only applicable to Mapbox layers, this is
 * a "list-like" interface.
 */
export function DefaultLayerItem({
  mapboxLayer,
  onSelect,
}: {
  mapboxLayer: T;
  onSelect: (arg0: T) => void;
}) {
  return (
    <Tooltip
      content={<Thumbnail mapboxLayer={mapboxLayer} />}
      side="left"
      delayDuration={0}
      zIndex={30}
      className="p-1! bg-popover! rounded-md! shadow-md!"
    >
      <button
        onClick={() => {
          onSelect(mapboxLayer);
        }}
        className={menuItemLike({ variant: "default" }) + " border"}
      >
        {mapboxLayer.name || "Untitled"}
      </button>
    </Tooltip>
  );
}
