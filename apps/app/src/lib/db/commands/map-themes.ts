import { getWorker, timed } from "@epanet-js/ejsdb";
import type { MapTheme } from "src/state/map-themes";
import { serializeMapTheme } from "../mappers/map-themes/to-rows";

export const saveMapTheme = async (theme: MapTheme): Promise<void> => {
  await timed("saveMapTheme", async () => {
    await getWorker().saveMapTheme(serializeMapTheme(theme));
  });
};

export const deleteMapTheme = async (id: string): Promise<void> => {
  await timed("deleteMapTheme", async () => {
    await getWorker().deleteMapTheme(id);
  });
};

export const saveActiveMapThemeId = async (
  id: string | null,
): Promise<void> => {
  await timed("saveActiveMapThemeId", async () => {
    await getWorker().saveActiveMapThemeId(id);
  });
};
