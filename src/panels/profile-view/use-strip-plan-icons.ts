import { useMemo } from "react";
import { buildIconUrls, IconId } from "src/map/icons/icons-sprite";
import { ProfileLink } from "./chart-data";

export type StripPlanIcons = {
  pumpUrl: (link: ProfileLink) => string | null;
  valveUrl: (link: ProfileLink) => string | null;
  iconUrl: (id: IconId) => string | null;
};

export function useStripPlanIcons(): StripPlanIcons {
  const urlById = useMemo(() => {
    const map = new Map<IconId, string>();
    for (const { id, url } of buildIconUrls()) {
      map.set(id, url);
    }
    return map;
  }, []);

  return useMemo(() => {
    const iconUrl = (id: IconId) => urlById.get(id) ?? null;

    const pumpUrl = (link: ProfileLink): string | null => {
      if (link.type !== "pump") return null;
      const id: IconId =
        link.status === "disabled"
          ? "pump-disabled"
          : link.status === "off"
            ? "pump-off"
            : "pump-on";
      return iconUrl(id);
    };

    const valveUrl = (link: ProfileLink): string | null => {
      if (link.type !== "valve" || !link.valveKind) return null;
      const id = `valve-${link.valveKind}-${link.status}` as IconId;
      return iconUrl(id);
    };

    return { pumpUrl, valveUrl, iconUrl };
  }, [urlById]);
}
