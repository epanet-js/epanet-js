import { getProjectionsBaseUrl } from "./config";
import { Proj4Projection } from "./projection";

export const getEsriWktString = async (
  projection: Proj4Projection,
): Promise<string> => {
  const { id, code } = projection;
  const fileName = id.replace(":", "_").toLowerCase();
  const baseUrl = getProjectionsBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/projection-data/${fileName}.json`);
    if (!response.ok) return code;
    const data = (await response.json()) as { wkt: string };
    return data.wkt;
  } catch {
    return code;
  }
};
